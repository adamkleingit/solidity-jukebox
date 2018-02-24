const assert = require('chai').assert;
const ganache = require('ganache-cli');
const Web3 = require('web3');

const web3 = new Web3(ganache.provider());
const { interface, bytecode } = require('../compile');

let accounts;
let jukebox;
let balance0;
let balance1;
const duration = 3;

function closeEnough(a, b) {
  assert(
    a - b < 0.001 || b - a < 0.001
  );  
}

const sleep = (duration) => new Promise((resolve) => {
  setTimeout(() => resolve(), duration);
});

describe('jukebox', () => {
  beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    jukebox = await new web3.eth.Contract(JSON.parse(interface))
      .deploy({ data: bytecode, arguments: [duration] })
      .send({ from: accounts[0], gas: '3000000' });
  });

  it('deploys a contract', () => {
    assert.ok(jukebox.options.address);
  });

  it('should have the correct manager', async () => {
    const manager = await jukebox.methods.manager().call();
    assert.equal(accounts[0], manager);
  });

  it('should have empty players', async () => {
    const players = await jukebox.methods.getPlayers().call();
    assert.equal(0, players.length);
  });

  describe('canEnter', () => {
    it ('should allow to enter while hasn\'t started', async () => {
      const canEnter = await jukebox.methods.canEnter(accounts[0]).call();
      assert(canEnter);
    });
    it ('should not allow to enter twice', async () => {
      await jukebox.methods.enter('pic', 'song').send({
        from: accounts[1],
        value: web3.utils.toWei('0.01', 'ether'),
        gas: '3000000'
      });
      const canEnter = await jukebox.methods.canEnter(accounts[1]).call();
      assert(!canEnter);
    });
    it ('should not allow to enter after game started', async () => {
      await jukebox.methods.start().send({
        from: accounts[0]
      });
      const canEnter = await jukebox.methods.canEnter(accounts[1]).call();
      assert(!canEnter);
    });
  });

  describe('enter', () => {
    it('should succeed if enough money', async () => {
      await jukebox.methods.enter('pic', 'song').send({
        from: accounts[1],
        value: web3.utils.toWei('0.01', 'ether'),
        gas: '3000000'
      });
      const players = await jukebox.methods.getPlayers().call();
      assert.equal(players.length, 1);
      assert.equal(players[0], accounts[1]);
    });
    it('enter should fail if not enough money', async () => {
      try {
        await jukebox.methods.enter('pic', 'song').send({
          from: accounts[0],
          value: web3.utils.toWei('0.001', 'ether'),
          gas: '3000000'
        });      
        assert(false);
      } catch (error) {
        assert(error);
      }
    });
  });

  describe('start', () => {
    it('should set the startTime', async () => {
      const now = Math.floor(new Date().getTime() / 1000);
      await jukebox.methods.start().send({
        from: accounts[0]
      });
      const startTime = await jukebox.methods.startTime().call();
      assert.isAtLeast(parseInt(startTime), now);
    });
    it('should restrict to manager', async () => {
      try {
        await jukebox.methods.start().send({
          from: accounts[1]
        });
        assert(false);
      } catch (error) {
        assert(error);
      }
    });
  });

  describe('canMove', () => {
    it('should not allow to move before start', async () => {
      const canMove = await jukebox.methods.canMove(accounts[1]).call();

      assert(!canMove);
    });
  });
  describe('after game started', () => {
    beforeEach(async () => {
      await jukebox.methods.enter('pic', 'song').send({
        from: accounts[1],
        value: web3.utils.toWei('0.01', 'ether'),
        gas: '3000000'
      });
      await jukebox.methods.enter('pic', 'song').send({
        from: accounts[2],
        value: web3.utils.toWei('0.01', 'ether'),
        gas: '3000000'
      });
      await jukebox.methods.start().send({
        from: accounts[0]
      });
    });
    describe('canMove', () => {
      it('should not allow to move if not entered', async () => {
        const canMove = await jukebox.methods.canMove(accounts[3]).call();

        assert(!canMove);
      });
      it('should not allow to move if already moving', async () => {
        await jukebox.methods.move().send({
          from: accounts[1]
        });
        const canMove = await jukebox.methods.canMove(accounts[1]).call();
        
        assert(!canMove);
      });  
      it('should not allow to move if finished all moves', async () => {
        await jukebox.methods.move().send({
          from: accounts[1]
        });
        await jukebox.methods.move().send({
          from: accounts[2]
        });
        await jukebox.methods.move().send({
          from: accounts[1]
        });
        await jukebox.methods.move().send({
          from: accounts[2]
        });
        const canMove = await jukebox.methods.canMove(accounts[1]).call();
        
        assert(!canMove);
      });  
      it('should allow to move if game started and player has moves, and is not currently moving', async () => {
        const canMove = await jukebox.methods.canMove(accounts[1]).call();
        
        assert(canMove);
      });  
      it('should not allow to move if after game ended', async () => {
      });  
    });
    describe('move', () => {
      it('should set moves, currentPlaying and currentPlayingStartedAt', async () => {
        const movesBefore = await jukebox.methods.playerMoves(accounts[1]).call();
        assert.equal(movesBefore, 2);
        const now = parseInt(new Date().getTime() / 1000);
        await jukebox.methods.move().send({
          from: accounts[1]
        });
        const movesAfter = await jukebox.methods.playerMoves(accounts[1]).call();
        const currentPlaying = await jukebox.methods.currentPlaying().call();
        const currentPlayingStartedAt = await jukebox.methods.currentPlayingStartedAt().call();
        assert.equal(movesAfter, 1);
        assert.equal(currentPlaying, accounts[1]);
        assert.equal(parseInt(currentPlayingStartedAt), now);
      });
      it('should set duration of running player when other player moves', async () => {
        await jukebox.methods.move().send({
          from: accounts[1]
        });
        await sleep(1000);
        await jukebox.methods.move().send({
          from: accounts[2]
        });
        const duration = await jukebox.methods.playerDurations(accounts[1]).call();
        assert.isAtLeast(parseInt(duration), 1);
      });
    });
    describe('getPlayerDuration', () => {
      it('should return 0 before moving', async () => {
        const duration = await jukebox.methods.getPlayerDuration(accounts[1]).call();
        assert(duration, 0);
      });
      it('should return 1 after moving and waiting for 1 second', async () => {
        await jukebox.methods.move().send({
          from: accounts[1]
        });
        await sleep(1000);
        const duration = await jukebox.methods.getPlayerDuration(accounts[1]).call();
        assert(duration, 1);
      });
      it('should return 1 after moving and waiting for 1 second and someone else moves', async () => {
        await jukebox.methods.move().send({
          from: accounts[1]
        });
        await sleep(1000);
        await jukebox.methods.move().send({
          from: accounts[2]
        });
        const duration = await jukebox.methods.getPlayerDuration(accounts[1]).call();
        assert(duration, 1);
      });
    });
    describe('canPickWinner', () => {
      it ('should not allow to pick winner before game ended', async () => {
        const canPickWinner = await jukebox.methods.canPickWinner().call();
        assert(!canPickWinner);
      });
      // TODO: fix
      // it ('should allow to pick winner after game ended', async () => {
      //   await sleep(4000);
      //   const canPickWinner = await jukebox.methods.canPickWinner().call();
      //   assert(canPickWinner);
      // }).timeout(5000);
      // it ('should not allow to pick winner if already picked', async () => {
      //   await sleep(4000);
      //   await jukebox.methods.pickWinner().send({
      //     from: accounts[0]
      //   });
      //   const canPickWinner = await jukebox.methods.canPickWinner().call();
      //   assert(!canPickWinner);
      // }).timeout(5000);
    });
    describe('pickWinner', () => {
      it('should not allow non-manager to pick winner', async () =>{
        try {
          await jukebox.methods.pickWinner().send({
            from: accounts[1]
          });
          assert(false);
        } catch(error) {
          assert.ok(error);
        }
      });
      // it('should set winner and send money to winner and manager', async () =>{
      //   const balance0 = await web3.eth.getBalance(accounts[0]);
      //   const balance1 = await web3.eth.getBalance(accounts[1]);

      //   await jukebox.methods.move().send({
      //     from: accounts[1]
      //   });
      //   await sleep(1000);
      //   await jukebox.methods.move().send({
      //     from: accounts[2]
      //   });
      //   await sleep(3000);
        
      //   await jukebox.methods.pickWinner().send({
      //     from: accounts[0],
      //     gas: '300000'
      //   });

      //   const winner = await jukebox.methods.winner().call();
      //   assert.equal(winner, accounts[2]);

      //   const newBalance0 = await web3.eth.getBalance(accounts[0]);
      //   const newBalance1 = await web3.eth.getBalance(accounts[1]);

      //   assert.isAbove(newBalance0, balance0);
      //   assert.isAbove(newBalance1, balance1);
      // }).timeout(5000);
    });
  });
  describe('canPickWinner', () => {
    it ('should not allow to pick winner before start', async () => {
      const canPickWinner = await jukebox.methods.canPickWinner().call();
      assert(!canPickWinner);
    });
  });
});


      // it('should send money to winner', async () => {
      //   const newBalance1 = await web3.eth.getBalance(accounts[1]);
      //   const newBalance2 = await web3.eth.getBalance(accounts[2]);

      //   assert(
      //     newBalance1 > balance1 || newBalance2 > balance2
      //   );
      // });
      // it('should send fee to manager', async () => {
      //   const newBalance0 = await web3.eth.getBalance(accounts[0]);
      //   const fee = web3.utils.toWei('0.004', 'ether');

      //   closeEnough(newBalance0, balance0 + fee);
      // });
    // });

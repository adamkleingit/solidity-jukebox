const assert = require("chai").assert;
const ganache = require("ganache-cli");
const Web3 = require("web3");

const web3 = new Web3(ganache.provider());
const { interface, bytecode } = require("../compile");

let accounts;
let jukebox;
let balance0;
let balance1;
const duration = 3;
const numMoves = 2;

function closeEnough(a, b) {
  assert(a - b < 0.001 || b - a < 0.001);
}

describe("jukebox", () => {
  beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    jukebox = await new web3.eth.Contract(JSON.parse(interface))
      .deploy({ data: bytecode, arguments: [duration, numMoves] })
      .send({ from: accounts[0], gas: "3000000" });
    await jukebox.methods.mockTime().send({
      from: accounts[0]
    });
  });

  it("deploys a contract", () => {
    assert.ok(jukebox.options.address);
  });

  it("should have the correct manager", async () => {
    const manager = await jukebox.methods.manager().call();
    assert.equal(accounts[0], manager);
  });

  it("should have empty players", async () => {
    const players = await jukebox.methods.getPlayers().call();
    assert.equal(0, players.length);
  });

  describe("canEnter", () => {
    it("should allow to enter while hasn't started", async () => {
      const canEnter = await jukebox.methods.canEnter(accounts[0]).call();
      assert(canEnter);
    });
    it("should not allow to enter twice", async () => {
      await jukebox.methods.enter("pic", "song").send({
        from: accounts[1],
        value: web3.utils.toWei("0.01", "ether"),
        gas: "3000000"
      });
      const canEnter = await jukebox.methods.canEnter(accounts[1]).call();
      assert(!canEnter);
    });
    it("should not allow to enter after game started", async () => {
      await jukebox.methods.start().send({
        from: accounts[0]
      });
      const canEnter = await jukebox.methods.canEnter(accounts[1]).call();
      assert(!canEnter);
    });
  });

  describe("enter", () => {
    it("should succeed if enough money", async () => {
      await jukebox.methods.enter("pic", "song").send({
        from: accounts[1],
        value: web3.utils.toWei("0.01", "ether"),
        gas: "3000000"
      });
      const players = await jukebox.methods.getPlayers().call();
      assert.equal(players.length, 1);
      assert.equal(players[0], accounts[1]);
    });
    it("enter should fail if not enough money", async () => {
      try {
        await jukebox.methods.enter("pic", "song").send({
          from: accounts[0],
          value: web3.utils.toWei("0.001", "ether"),
          gas: "3000000"
        });
        assert(false);
      } catch (error) {
        assert(error);
      }
    });
  });

  describe("start", () => {
    it("should set the startTime", async () => {
      const now = Math.floor(new Date().getTime() / 1000);
      await jukebox.methods.start().send({
        from: accounts[0]
      });
      const startTime = await jukebox.methods.startTime().call();
      assert.isAtLeast(parseInt(startTime), now);
    });
    it("should restrict to manager", async () => {
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

  describe("canMove", () => {
    it("should not allow to move before start", async () => {
      const canMove = await jukebox.methods.canMove(accounts[1]).call();

      assert(!canMove);
    });
  });
  describe("after game started", () => {
    beforeEach(async () => {
      await jukebox.methods.enter("pic1", "song1").send({
        from: accounts[1],
        value: web3.utils.toWei("0.01", "ether"),
        gas: "3000000"
      });
      await jukebox.methods.enter("pic2", "song2").send({
        from: accounts[2],
        value: web3.utils.toWei("0.01", "ether"),
        gas: "3000000"
      });
      await jukebox.methods.start().send({
        from: accounts[0]
      });
    });
    describe("canMove", () => {
      it("should not allow to move if not entered", async () => {
        const canMove = await jukebox.methods.canMove(accounts[3]).call();

        assert(!canMove);
      });
      it("should not allow to move if already moving", async () => {
        await jukebox.methods.move().send({
          from: accounts[1]
        });
        const canMove = await jukebox.methods.canMove(accounts[1]).call();

        assert(!canMove);
      });
      it("should not allow to move if finished all moves", async () => {
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
      it("should allow to move if game started and player has moves, and is not currently moving", async () => {
        const canMove = await jukebox.methods.canMove(accounts[1]).call();

        assert(canMove);
      });
      it("should not allow to move if after game ended", async () => {});
    });
    describe("move", () => {
      it("should set moves, currentPlaying and currentPlayingStartedAt", async () => {
        const movesBefore = await jukebox.methods
          .playerMoves(accounts[1])
          .call();
        assert.equal(movesBefore, 2);
        const now = await jukebox.methods.currTime().call();
        await jukebox.methods.move().send({
          from: accounts[1]
        });
        const movesAfter = await jukebox.methods
          .playerMoves(accounts[1])
          .call();
        const currentPlaying = await jukebox.methods.currentPlaying().call();
        const currentPlayingStartedAt = await jukebox.methods
          .currentPlayingStartedAt()
          .call();
        assert.equal(movesAfter, 1);
        assert.equal(currentPlaying, accounts[1]);
        assert.equal(parseInt(currentPlayingStartedAt), now);
      });
      it("should set duration of running player when other player moves", async () => {
        await jukebox.methods.move().send({
          from: accounts[1]
        });
        await jukebox.methods.sleep(1).send({ from: accounts[0] });
        await jukebox.methods.move().send({
          from: accounts[2]
        });
        const duration = await jukebox.methods
          .playerDurations(accounts[1])
          .call();
        assert.isAtLeast(parseInt(duration), 1);
      });
    });
    describe("getPlayerDuration", () => {
      it("should return 0 before moving", async () => {
        const duration = await jukebox.methods
          .getPlayerDuration(accounts[1])
          .call();
        assert(duration, 0);
      });
      it("should return 1 after moving and waiting for 1 second", async () => {
        await jukebox.methods.move().send({
          from: accounts[1]
        });
        await jukebox.methods.sleep(1).send({ from: accounts[0] });
        const duration = await jukebox.methods
          .getPlayerDuration(accounts[1])
          .call();
        assert(duration, 1);
      });
      it("should return 1 after moving and waiting for 1 second and someone else moves", async () => {
        await jukebox.methods.move().send({
          from: accounts[1]
        });
        await jukebox.methods.sleep(1).send({ from: accounts[0] });
        await jukebox.methods.move().send({
          from: accounts[2]
        });
        const duration = await jukebox.methods
          .getPlayerDuration(accounts[1])
          .call();
        assert(duration, 1);
      });
    });
    describe("canPickWinner", () => {
      it("should not allow to pick winner before game ended", async () => {
        const canPickWinner = await jukebox.methods.canPickWinner().call();
        assert(!canPickWinner);
      });
      it("should allow to pick winner after game ended", async () => {
        await jukebox.methods.sleep(4).send({ from: accounts[0] });
        const canPickWinner = await jukebox.methods.canPickWinner().call();
        assert(canPickWinner);
      });
      it("should not allow to pick winner if already picked", async () => {
        await jukebox.methods.move().send({ from: accounts[1] });
        await jukebox.methods.sleep(4).send({ from: accounts[0] });
        await jukebox.methods.pickWinner().send({ from: accounts[0] });
        const canPickWinner = await jukebox.methods.canPickWinner().call();
        const winner = await jukebox.methods.winner().call();
        assert(!canPickWinner);
      });
    });
    describe("pickWinner", () => {
      it("should not allow non-manager to pick winner", async () => {
        try {
          await jukebox.methods.pickWinner().send({
            from: accounts[1]
          });
          assert(false);
        } catch (error) {
          assert.ok(error);
        }
      });
      it("should set winner and send money to winner and manager", async () => {
        const balance0 = await web3.eth.getBalance(accounts[0]);
        const balance1 = await web3.eth.getBalance(accounts[1]);

        await jukebox.methods.move().send({
          from: accounts[1]
        });
        await jukebox.methods.sleep(1).send({ from: accounts[0] });
        await jukebox.methods.move().send({
          from: accounts[2]
        });
        await jukebox.methods.sleep(3).send({ from: accounts[0] });

        await jukebox.methods.pickWinner().send({
          from: accounts[0],
          gas: "600000"
        });

        const winner = await jukebox.methods.winner().call();
        assert.equal(winner, accounts[2]);

        // TODO: verify balance
        // const newBalance0 = await web3.eth.getBalance(accounts[0]);
        // const newBalance1 = await web3.eth.getBalance(accounts[1]);

        // assert.isAbove(newBalance0, balance0);
        // assert.isAbove(newBalance1, balance1);
      });
    });
    describe("current player info", () => {
      beforeEach(async () => {
        await jukebox.methods.move().send({
          from: accounts[1]
        });
        await jukebox.methods.move().send({
          from: accounts[2]
        });
      });
      it("getCurrentPlayingPictureUrl", async () => {
        const currentPlayingPictureUrl = await jukebox.methods
          .getCurrentPlayingPictureUrl()
          .call();

        assert.equal(currentPlayingPictureUrl, "pic2");
      });
      it("getCurrentPlayingSongUrl", async () => {
        const currentPlayingSongUrl = await jukebox.methods
          .getCurrentPlayingSongUrl()
          .call();

        assert.equal(currentPlayingSongUrl, "song2");
      });
    });
    describe("reset", () => {
      beforeEach(async () => {
        await jukebox.methods.move().send({
          from: accounts[1]
        });
        await jukebox.methods.sleep(1).send({ from: accounts[0] });
        await jukebox.methods.move().send({
          from: accounts[2]
        });
        await jukebox.methods.sleep(3).send({ from: accounts[0] });

        await jukebox.methods.pickWinner().send({
          from: accounts[0],
          gas: "600000"
        });
      });
      it("should reset everything", async () => {
        await jukebox.methods.reset(4, 4, true).send({
          from: accounts[0],
          gas: "600000"
        });
        const players = await jukebox.methods.getPlayers().call();
        const playerDuration = await jukebox.methods
          .playerDurations(accounts[1])
          .call();
        const playerMoves = await jukebox.methods
          .playerMoves(accounts[1])
          .call();
        const currentPlaying = await jukebox.methods.currentPlaying().call();
        const currentPlayingStartedAt = await jukebox.methods
          .currentPlayingStartedAt()
          .call();
        const winner = await jukebox.methods.winner().call();
        const duration = await jukebox.methods.duration().call();
        const maxPlayerMoves = await jukebox.methods.maxPlayerMoves().call();
        assert.equal(players.length, 0);
        assert.equal(parseInt(playerDuration), 0);
        assert.equal(parseInt(playerMoves), 0);
        assert.equal(winner, 0);
        assert.equal(currentPlaying, 0);
        assert.equal(parseInt(currentPlayingStartedAt), 0);
        assert.equal(parseInt(duration), 4);
        assert.equal(parseInt(maxPlayerMoves), 4);
      });
      it("should reset everything but keep players", async () => {
        await jukebox.methods.reset(4, 4, false).send({
          from: accounts[0],
          gas: "600000"
        });
        const players = await jukebox.methods.getPlayers().call();
        const playerDuration = await jukebox.methods
          .playerDurations(accounts[1])
          .call();
        const playerMoves = await jukebox.methods
          .playerMoves(accounts[1])
          .call();
        const currentPlaying = await jukebox.methods.currentPlaying().call();
        const currentPlayingStartedAt = await jukebox.methods
          .currentPlayingStartedAt()
          .call();
        const winner = await jukebox.methods.winner().call();
        const duration = await jukebox.methods.duration().call();
        const maxPlayerMoves = await jukebox.methods.maxPlayerMoves().call();
        assert.equal(players.length, 2);
        assert.equal(parseInt(playerDuration), 0);
        assert.equal(parseInt(playerMoves), 4);
        assert.equal(winner, 0);
        assert.equal(currentPlaying, 0);
        assert.equal(parseInt(currentPlayingStartedAt), 0);
        assert.equal(parseInt(duration), 4);
        assert.equal(parseInt(maxPlayerMoves), 4);
      });
    });
  });
  describe("canPickWinner", () => {
    it("should not allow to pick winner before start", async () => {
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

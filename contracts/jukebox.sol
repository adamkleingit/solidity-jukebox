pragma solidity ^0.4.17;

contract Jukebox {
    struct PlayerInfo {
        string pictureUrl;
        string songUrl;
    }
    mapping (address => PlayerInfo) public playerInfos;
    mapping (address => uint) public playerDurations;
    mapping (address => uint) public playerMoves;
    address[] public players;
    address public currentPlaying;
    uint public currentPlayingStartedAt;
    uint public startTime;
    uint public duration;

    address public manager;
    address public winner;

    function Jukebox(uint _duration) public {
        manager = msg.sender;
        duration = _duration;
    }

    modifier restricted() {
        require(msg.sender == manager);
        _;        
    }

    function canEnter(address addr) public view returns (bool) {
        // game hasn't started, and player hasn't joined already
        return (startTime == 0) && playerMoves[addr] == 0;
    }

    function enter(string pictureUrl, string songUrl) public payable {
        require(canEnter(msg.sender));
        require((msg.value >= .01 ether));

        playerInfos[msg.sender] = PlayerInfo({
            pictureUrl: pictureUrl,
            songUrl: songUrl
        });
        playerMoves[msg.sender] = 2;
        players.push(msg.sender);
    }

    function getPlayers() public view returns (address[]) {
        return players;
    }

    function start() public restricted {
        startTime = now;
    }
    
    function stopTime() private view returns (uint) {
        return startTime + duration;
    }
    
    function canMove(address addr) public view returns (bool) {
        // current player can't move, and current player has moves left, and time is not over
        return (currentPlaying != addr) && (playerMoves[addr] > 0) && (now < stopTime());
    }

    function move() public {
        require (canMove(msg.sender));
        uint currentTime = now;

        // If there's an active player - stop them and fix their duration
        if (currentPlaying != address(0)) {
            playerDurations[currentPlaying] += now - currentPlayingStartedAt;
        }
        playerMoves[msg.sender]--;
        currentPlaying = msg.sender;
        currentPlayingStartedAt = currentTime;
    }

    function getPlayerDuration(address addr) public view returns (uint) {
        uint result = playerDurations[addr];

        // If currently running - add the active move duration
        if (currentPlaying == addr) {
            result += min(now, stopTime()) - currentPlayingStartedAt;
        }

        return result;
    }

    function canPickWinner() public view returns (bool) {
         // game started, and haven't picked winner already, and game time ended
        return (startTime != 0 && winner == address(0) && now >= stopTime());
    }

    function pickWinner() public restricted {
        require(canPickWinner());

        // If there's an active player - stop them and fix their duration
        if (currentPlaying != address(0)) {
            playerDurations[currentPlaying] += stopTime() - currentPlayingStartedAt;
            currentPlayingStartedAt = 0;
            currentPlaying = address(0);
        }

        winner = bestPlayer();
        winner.transfer(this.balance * 9 / 10);
        manager.transfer(this.balance);        
    }
    
    function bestPlayer() private view returns (address) {
        address curWinner;
        uint result = 0;

        for (uint i = 1; i < players.length; i++) {
            uint curDuration = playerDurations[players[i]];

            if (curDuration > result) {
                curWinner = players[i];
                result = curDuration;
            }
        }
        return curWinner;        
    }

    function min(uint a, uint b) private pure returns (uint) {
        return a < b ? a : b;
    }
    
    function random() private view returns (uint) {
        return uint(keccak256(block.difficulty, now, players));
    }
}
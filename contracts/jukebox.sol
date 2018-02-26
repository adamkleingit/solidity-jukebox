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
    uint public maxPlayerMoves;

    address public manager;
    address public winner;

    uint fakeTime;

    function Jukebox(uint _duration, uint _maxPlayerMoves) public {
        manager = msg.sender;
        duration = _duration;
        maxPlayerMoves = _maxPlayerMoves;
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
        playerMoves[msg.sender] = maxPlayerMoves;
        players.push(msg.sender);
    }

    function getPlayers() public view returns (address[]) {
        return players;
    }

    function start() public restricted {
        startTime = currTime();
    }
    
    function stopTime() public view returns (uint) {
        return startTime + duration;
    }
    
    function canMove(address addr) public view returns (bool) {
        // current player can't move, and current player has moves left, and time is not over
        return (currentPlaying != addr) && (playerMoves[addr] > 0) && (currTime() < stopTime());
    }

    function move() public {
        require (canMove(msg.sender));
        uint currentTime = currTime();

        // If there's an active player - stop them and fix their duration
        if (currentPlaying != address(0)) {
            playerDurations[currentPlaying] += currentTime - currentPlayingStartedAt;
        }
        playerMoves[msg.sender]--;
        currentPlaying = msg.sender;
        currentPlayingStartedAt = currentTime;
    }

    function getPlayerDuration(address addr) public view returns (uint) {
        uint result = playerDurations[addr];

        // If currently running - add the active move duration
        if (currentPlaying == addr) {
            result += min(currTime(), stopTime()) - currentPlayingStartedAt;
        }

        return result;
    }

    function getCurrentPlayingPictureUrl() public view returns (string) {
        require(currentPlaying != address(0));
        
        return playerInfos[currentPlaying].pictureUrl;
    }

    function getCurrentPlayingSongUrl() public view returns (string) {
        require(currentPlaying != address(0));
        
        return playerInfos[currentPlaying].songUrl;
    }

    function canPickWinner() public view returns (bool) {
         // game started, and haven't picked winner already, and game time ended
        return (startTime != 0 && winner == address(0) && currTime() >= stopTime());
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
        // TODO: transfer funds
        // uint fee = this.balance / 10;
        // winner.transfer(this.balance - fee);
        // manager.transfer(fee);
    }

    function reset(uint _duration, uint _maxPlayerMoves, bool clearPlayers) public restricted {
        duration = _duration;
        maxPlayerMoves = _maxPlayerMoves;
        for (uint i = 0; i < players.length; i++) {
            address player = players[i];

            playerDurations[player] = 0;
            if (clearPlayers) {
                playerInfos[player] = PlayerInfo("", "");
                playerMoves[player] = 0;
            } else {
                playerMoves[player] = maxPlayerMoves;
            }
        }
        if (clearPlayers) {
            players = new address[](0);
        }
        winner = address(0);
        currentPlaying = address(0);
        currentPlayingStartedAt = 0;
        startTime = 0;
    }
    
    function bestPlayer() private view returns (address) {
        address curWinner;
        uint result = 0;

        for (uint i = 0; i < players.length; i++) {
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
        return uint(keccak256(block.difficulty, currTime(), players));
    }

    function currTime() public view returns (uint) {
        return fakeTime == 0 ? now : fakeTime;
    }
    // time mocking
    function mockTime() public restricted {
        fakeTime = now;
    }

    function sleep(uint timeInseconds) public restricted {
        fakeTime += timeInseconds;
    }
}

const HDWalletProvider = require('truffle-hdwallet-provider');
const Web3 = require('web3');
const { interface, bytecode } = require('./compile');

const provider = new HDWalletProvider(
  'border awkward curve practice nice south uphold super route hen sunny critic',
  'https://rinkeby.infura.io/YcRY4i7oT4zJ50Br5ZOU'
);

const web3 = new Web3(provider);

const deploy = async () => {
  accounts = await web3.eth.getAccounts();
  result = await new web3.eth.Contract(JSON.parse(interface))
    .deploy({ data: bytecode, arguments: [300000]})
    .send({ from: accounts[0], gas: '1000000' });

  console.log(result.options.address);
};
deploy();

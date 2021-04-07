## EthItem - An improved ERC1155 token with ERC20 trading capabilities.
In the EthItem standard, there is no a centralized storage where to save every objectId info.

In fact every NFT data is saved in a specific ERC20 token that can also work as a standalone one, and let transfer parts of an atomic object.

The ERC20 represents a unique Token Id, and its supply represents the entire supply of that Token Id.

You can instantiate a EthItem as a brand-new one, or as a wrapper for pre-existent classic ERC1155 NFT.

In the first case, you can introduce some particular permissions to mint new tokens.
In the second case, you need to send your NFTs to the Wrapped EthItem (using the classic safeTransferFrom or safeBatchTransferFrom methods)
and it will create a brand new ERC20 Token or mint new supply (in the case some tokens with the same id were transfered before yours).

<img src="https://raw.githubusercontent.com/b-u-i-d-l/eth-item-token-standard/master/info.jpg">

## Documentation:

https://b-u-i-d-l.github.io/eth-item-token-standard/

## Announcement:


## Early Tests using the <a href="https://github.com/b-u-i-d-l/super-saiyan-token">SSJ Token</a>:

### Uniswap ERC20 Approach

<a href="https://etherscan.io/tx/0x83b0bfba8b936e9df48b041e165c05eb5f7debb9af69463a76e5c0ce7bac7f93">Uniswap V2  Approve</a>
 
<a href="https://etherscan.io/tx/0x3e02983346674ef1b8b1160fe9fd880414deff0d6356f64c902cbcc0cd69d23b">Uniswap V2 Add Liquidity Item Token - ETH</a>

<a href="https://etherscan.io/tx/0x21f38e8d8244ad950e00febba765ba2f8ea80b1e03a9032928cc7a57f4fde103">Uniswap V2 Remove Liquidity Item Token - ETH</a>


<a href="https://etherscan.io/tx/0x1896bae5da015412d23d8ad3348a4b9188dfbcd1acd25db6931cabb0492a52f7">Uniswap V2 Add Liquidity Item Token - ERC20</a>

<a href="https://etherscan.io/tx/0x69022eada4372c329edfbc8385866c1ccd7bd705952bf8f4f31fed868a726239">Uniswap V2 Remove Liquidity Item Token - ERC20</a>

<a href="https://etherscan.io/tx/0x42898b045f809888e4d489cabb0683b83ecc74ff1ec6f71c42a4431a80d84fee">Uniswap V2 Swap Item Token to ETH</a>

<a href="https://etherscan.io/tx/0x628d50cedf03e8fef10cc522df55e67f812a8247aa275abd8ebe5311960db756">Uniswap V2 Swap ETH to Item Token</a>

<a href="https://etherscan.io/tx/0xe2a6c508bedc73ada144084bad04919fc6b1519b8f03329e7488287a6bbfab35">Uniswap V2 Swap Item Token to ERC20</a>

<a href="https://etherscan.io/tx/0x1debe4f2e05fc99611f81713f2108dffb46dfbf4474dae829a7890c8ce704c07">Uniswap V2 Swap ERC20 to Item Token</a>

### MooniSwap ERC20 Approach

<a href="https://etherscan.io/tx/0xe5fb75bee1cf5f490b4e83bcc7bcc6d1eef4234aa0be6b00610dee3391ffac22">MooniSwap Approve</a>

<a href="https://etherscan.io/tx/0x6edf771cf8483eb5d93b7d8283b23270e8241480ee331260112d7c3726e94dc8">MooniSwap Add Liquidity Item Token - ETH</a>

<a href="https://etherscan.io/tx/0xa5a3a415f7b0f098bcc914f877f78858db9ccc7e2a63492aa5bbd95e07e872af">MooniSwap Remove Liquidity Item Token - ETH</a>

<a href="https://etherscan.io/tx/0x538035b714ffbe947b3595f724457c97e7b27549e2afac5cae1cce6b848ef6b0">MooniSwap Add Liquidity Item Token - ERC20</a>

<a href="https://etherscan.io/tx/0xb56b613222e02162e5bbb2f6c728aa426a0980fd10ac8907e3dd707faa6eab26">MooniSwap Remove Liquidity Item Token - ERC20</a>

<a href="https://etherscan.io/tx/0xdda28163e7199e6cfdd5274103c2975ffa1dcb007124079694943ace368a4ec6">MooniSwap Swap Item Token to ETH</a>

<a href="https://etherscan.io/tx/0x3cf86d5914b1e8513036926b8f91b997a8d217d77edfafb18cb721b535226d10">MooniSwap Swap ETH to Item Token</a>

<a href="https://etherscan.io/tx/0xbd4ae5e4bdfa4b9a57c25970c2f2a1a3eab9d5483e6345035903d78c75b00019">MooniSwap Swap Item Token to ERC20</a>

<a href="https://etherscan.io/tx/0xdfbb21397e42e23b75ed46e4f473c767e3af6ebe282f5491480ae8ac19f28c19">MooniSwap Swap ERC20 to Item Token</a>



### Balancer ERC20 Approach

<a href="https://etherscan.io/tx/0x376dbd77426f42c71a8585ee3337ce99924b3a8ae6a1f84e66f966fa277ed762">Balancer Approve</a>

<a href="https://etherscan.io/tx/0x294596ddd6b806fd500068b48e316264041a9d207763e3653f5f8399d752438c">Balancer Add Liquidity Item Token</a>

<a href="https://etherscan.io/tx/0xa756126028cdb137ee04d5db44674d2354a9c5a0e02d7f400d3d9a179dbe1978">Balancer Remove Liquidity Item Token - ERC20</a>

<a href="https://etherscan.io/tx/0xccf7295a8b3db6a6f1949d315a0dfca887e9bb6e34d4a49d57e31ca0e466b14e">Balancer Remove Only Liquidity Item Token</a>

<a href="https://etherscan.io/tx/0x8c6aa7866b8dd9e2bca0da5e06f775410c5f17d371ae88fb68dda1f32b2924f4">Balancer Swap Item Token to ERC20 </a>

<a href="https://etherscan.io/tx/0x90bdd5e2f41338a0179590377271b6302b09a70ca5b7423f767e4b29f4815d72">Balancer Swap ERC20 to Item Token </a>


### ForkDelta ERC20 Approach

<a href="https://etherscan.io/tx/0xa2b8fe9c4f8d97401d7db45270f65de2c21c56823ffed75622db0d64331dae4d">ForkDelta Approve</a>

<a href="https://etherscan.io/tx/0x00475f07b6b7ad9114c07f84ae6158167297821ae7d15278285f8475f2073528">ForkDelta Add</a>

<a href="https://etherscan.io/tx/0xe9a940042737de275735dde73bd4d6cd26b45c2e5f6ba55eacfd4aa111ffc6bc">ForkDelta Exchange buy order</a>


### 1inch ERC20 Approach

<a href="https://etherscan.io/tx/0x81b1ba4ed93dbbeac6606aa0a1952043a308bee9e692f263b1ca394e89eed0ed">1inch Approve</a>

<a href="https://etherscan.io/tx/0x8b1955320138ac22e2a7cc7498e3192b3ad46ad90a5e135ac893dcc4e4671cbe">1inch Lock</a>

<a href="https://etherscan.io/tx/0xef16bd340d029ab280213123a25bbbe503c0990e4f160c6710ccb644f8b299ec">1inch Infinite Approve</a>

<a href="https://etherscan.io/tx/0xbb363683f612a8870d2f72e2b59d67c0425ce1b8052eedc7d7ddff417514c383">1inch Exchange Item Token to ETH </a>

<a href="https://etherscan.io/tx/0xea2b9d5fd5518b91cc76e05b79d268a2fca09a6a3ec4e78eceb44481bd0321ba">1inch Exchange ETH to Item Token</a>


### OpenSea ERC 1155 Approach

<a href="https://etherscan.io/tx/0x5c5d6636fabe16d45fee385a46e907317fd66bcc35bbf306656e5520bf9cd876">OpenSea Gift to wallet</a>

<a href="https://etherscan.io/tx/0xe3ab895773860aa701f6c710ed255adaca95bef7c021b3b6c54be59602f7e9aa">OpenSea Trade</a>

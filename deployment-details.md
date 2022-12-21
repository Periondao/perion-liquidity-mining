PERC POOL DEPLOYMENT:
Deploying PERC Pool ProxyAdmin
PERC Pool ProxyAdmin deployed to 0xDbb876DE2190264474Fe38b5C982A8653aD02610

Deploying PERC Pool Implementation
PERC Pool Implementation deployed to 0xf5Da9d58E77710DaBcF4102e62A5d64FEB125F67

Deploying PERC Pool Proxy
PERC Pool Proxy deployed to 0x3B72ad3dF08E187df7383243733Fd0AC77F7b7ba


PERCETHLP POOL DEPLOYMENT:
Deploying PERCETHLP Pool ProxyAdmin
PERCETHLP Pool ProxyAdmin deployed to 0xC833b95287a78b463C991A9Be7b283238425D441

Deploying PERCETHLP Pool Implementation
PERCETHLP Pool Implementation deployed to 0xEd0001b0cdA3d6C5ba79AeB27Bb525Fd317caf4A

Deploying PERC-ETH-LP Pool Proxy
PERCETHLP Pool Proxy deployed to 0xd435dd6c520388649aE6D23cACa7724D24Dd1bB3


Assigning roles:
MULTISIG (0x53212fAe1AD95C6d2634553F7de95d1893EA3fd0) recieved GOV_ROLE of PERCPoolProxy (0x3B72ad3dF08E187df7383243733Fd0AC77F7b7ba)
MULTISIG (0x53212fAe1AD95C6d2634553F7de95d1893EA3fd0) received DEFAULT_ADMIN_ROLE of PERCPoolProxy (0x3B72ad3dF08E187df7383243733Fd0AC77F7b7ba)
MULTISIG (0x53212fAe1AD95C6d2634553F7de95d1893EA3fd0) recieved GOV_ROLE of percEthlpPoolProxy (0xd435dd6c520388649aE6D23cACa7724D24Dd1bB3)
MULTISIG (0x53212fAe1AD95C6d2634553F7de95d1893EA3fd0) recieved DEFAULT_ADMIN_ROLE of percEthlpPoolProxy (0xd435dd6c520388649aE6D23cACa7724D24Dd1bB3)


CHECK MANUALLY IF EVERYTHING IS CORRECTLY SETUP:
-MULTISIG has GOV_ROLE in both pools: true, true
-MULTISIG has DEFAULT_ADMIN_ROLE in both pools: true, true

THEN WITH THE DEPLOYER:
-deposit for 3 years more than $100 PERC in PERC Pool
-deposit for 3 years more than $100 LP in LP Pool
-transfer ownership to MULTISIG in percPoolProxyAdmin and percEthlpPoolProxyAdmin
-renounce DEFAULT_ADMIN_ROLE in both pools

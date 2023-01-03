PERC POOL DEPLOYMENT:
Deploying PERC Pool ProxyAdmin
PERC Pool ProxyAdmin deployed to 0x2F1450ED346c0dA14a9ff902Ed57B882D505612F

Deploying PERC Pool Implementation
PERC Pool Implementation deployed to 0xfB87bC283E3b0D5B25A8B97A85A2b2dcEfA8A00d

Deploying PERC Pool Proxy
PERC Pool Proxy deployed to 0x9f130Be7bf195eb94aF4090a1dca89DC2E4926E5


PERCETHLP POOL DEPLOYMENT:
Deploying PERCETHLP Pool ProxyAdmin
PERCETHLP Pool ProxyAdmin deployed to 0xe855fE8cCa6c7BCB1948Be6345C99Cc3A92E4963

Deploying PERCETHLP Pool Implementation
PERCETHLP Pool Implementation deployed to 0xb72039bDa6f7BbF0d78C3E7F73dF7d1371ADE218

Deploying PERC-ETH-LP Pool Proxy
PERCETHLP Pool Proxy deployed to 0xB303Fae865d4A6403a228A0EAd209CE76992c19e


Assigning roles:
MULTISIG (0x53212fAe1AD95C6d2634553F7de95d1893EA3fd0) recieved GOV_ROLE of PERCPoolProxy (0x9f130Be7bf195eb94aF4090a1dca89DC2E4926E5)
MULTISIG (0x53212fAe1AD95C6d2634553F7de95d1893EA3fd0) received DEFAULT_ADMIN_ROLE of PERCPoolProxy (0x9f130Be7bf195eb94aF4090a1dca89DC2E4926E5)
MULTISIG (0x53212fAe1AD95C6d2634553F7de95d1893EA3fd0) recieved GOV_ROLE of percEthlpPoolProxy (0xB303Fae865d4A6403a228A0EAd209CE76992c19e)
MULTISIG (0x53212fAe1AD95C6d2634553F7de95d1893EA3fd0) recieved DEFAULT_ADMIN_ROLE of percEthlpPoolProxy (0xB303Fae865d4A6403a228A0EAd209CE76992c19e)


CHECK MANUALLY IF EVERYTHING IS CORRECTLY SETUP:
-MULTISIG has GOV_ROLE in both pools: true, true
-MULTISIG has DEFAULT_ADMIN_ROLE in both pools: true, true

THEN WITH THE DEPLOYER:
-deposit for 3 years more than $100 PERC in PERC Pool
-deposit for 3 years more than $100 LP in LP Pool
-transfer ownership to MULTISIG in percPoolProxyAdmin and percEthlpPoolProxyAdmin
-renounce DEFAULT_ADMIN_ROLE in both pools

❤⭕

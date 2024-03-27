# Error codes

> [!IMPORTANT]
> Errors triggered by `User but controlled by backend` should never be seen by the user if they use the UI

-   [Term Initialization Related](#term-initialization-related)
-   [Term Expiration Related](#term-expiration-related)
-   [Join Term Related](#join-term-related)
-   [Auto Pay Related](#auto-pay-related)
-   [Contribution Payment Related](#contribution-payment-related)
-   [Withdraw Money Pot Related](#withdraw-money-pot-related)
-   [Withdraw Collateral Related](#withdraw-collateral-related)
-   [Cycle Management Related](#cycle-management-related)
-   [Yield Related](#yield-related)
-   [Others](#others)

## Term Initialization Related

| Error code | Description                  | Trigger by |
| :--------: | :--------------------------- | :--------: |
|  TT-TF-01  | Invalid inputs               |  Backend   |
|  TT-TF-09  | Term not ready to start      |  Backend   |
|  TT-TF-10  | Positions are not filled     |  Backend   |
|  TT-TF-11  | Eth prices dropped           |  Backend   |
|  TT-TF-12  | Fund already exists          |  Backend   |
|  TT-LF-01  | Too early to start new cycle |  Backend   |
|  TT-LF-02  | Wrong state                  |  Backend   |
|  TT-LF-03  | Fund closed                  |  Backend   |

[top](#error-codes)

## Term Expiration Related

| Error code | Description                        | Trigger by |
| :--------: | :--------------------------------- | :--------: |
|  TT-TF-13  | Registration period not ended      |  Backend   |
|  TT-TF-14  | All positions filled, can't expire |  Backend   |
|  TT-TF-15  | Term already expired               |  Backend   |

[top](#error-codes)

## Join Term Related

| Error code | Description            |           Trigger by           |
| :--------: | :--------------------- | :----------------------------: |
|  TT-TF-02  | Term doesn't exist     | User but controlled by backend |
|  TT-TF-03  | Closed                 | User but controlled by backend |
|  TT-TF-04  | No space               | User but controlled by backend |
|  TT-TF-05  | Reentry                | User but controlled by backend |
|  TT-TF-06  | Invalid position       | User but controlled by backend |
|  TT-TF-07  | Position already taken | User but controlled by backend |
|  TT-TF-08  | Eth payment too low    | User but controlled by backend |

[top](#error-codes)

## Auto Pay Related

| Error code | Description                   |   Trigger by   |
| :--------: | :---------------------------- | :------------: |
|  TT-FF-02  | Wrong state                   | User / Backend |
|  TT-FF-05  | Pay collateral security first |      User      |

[top](#error-codes)

## Contribution Payment Related

| Error code | Description                                        |   Trigger by   |
| :--------: | :------------------------------------------------- | :------------: |
|  TT-FF-02  | Wrong state                                        | User / Backend |
|  TT-FF-07  | Contribution failed, did you approve stable token? |      User      |
|  TT-FF-12  | Not a participant                                  |      User      |
|  TT-FF-13  | Already paid for cycle                             |      User      |
|  TT-FF-14  | Beneficiary doesn't pay                            |      User      |
|  TT-FF-15  | Participant is exempted this cycle                 |      User      |

[top](#error-codes)

## Withdraw Money Pot Related

| Error code | Description                                   |           Trigger by           |
| :--------: | :-------------------------------------------- | :----------------------------: |
|  TT-FF-04  | Transfer failed                               |         User / Backend         |
|  TT-FF-08  | The caller must be a participant              |              User              |
|  TT-FF-09  | Nothing to withdraw                           |              User              |
|  TT-FF-10  | Fund frozen, need at least 1.1RCC to unfreeze |              User              |
|  TT-LC-01  | Fund does not exists                          | User but controlled by backend |
|  TT-LC-02  | Nothing to claim                              | User but controlled by backend |

[top](#error-codes)

## Withdraw Collateral Related

| Error code | Description                  |           Trigger by           |
| :--------: | :--------------------------- | :----------------------------: |
|  TT-CF-01  | Caller must be a participant |              User              |
|  TT-CF-04  | Nothing to withdraw          |              User              |
|  TT-CF-05  | Withdraw failed              |              User              |
| TT-LYG-01  | No yield to withdraw         | User but controlled by backend |

[top](#error-codes)

## Cycle Management Related

| Error code | Description                  |   Trigger by   |
| :--------: | :--------------------------- | :------------: |
|  TT-FF-01  | Still time to contribute     |    Backend     |
|  TT-FF-02  | Wrong state                  | User / Backend |
|  TT-FF-06  | Can’t remove defaulter       |    Backend     |
|  TT-FF-11  | Expellant not found          |    Backend     |
|  TT-LF-01  | Too early to start new cycle |    Backend     |
|  TT-LF-02  | Wrong state                  |    Backend     |
|  TT-LF-03  | Fund closed                  |    Backend     |

[top](#error-codes)

## Yield Related

| Error code | Description                                       |           Trigger by           |
| :--------: | :------------------------------------------------ | :----------------------------: |
|  TT-YF-01  | The caller must be a participant                  |              User              |
|  TT-YF-02  | Too late to change YG opt in                      | User but controlled by backend |
|  TT-YF-03  | Pay the security deposit first                    | User but controlled by backend |
|  TT-YF-04  | Fund does not exist                               |            Backend             |
|  TT-YF-05  | Invalid provider address                          |            Backend             |
|  TT-YF-06  | Same provider address                             |            Backend             |
|  TT-YF-07  | Arrays don't match                                |            Backend             |
|  TT-YF-08  | User not part of yield generation                 |            Backend             |
|  TT-YF-09  | Not enough ETH value sent                         |            Backend             |
|  TT-YF-10  | Final share balance incorrect                     |            Backend             |
|  TT-YF-11  | Failed to send leftover ETH back                  |            Backend             |
|  TT-YF-12  | Shares target not reached                         |            Backend             |
|  TT-YF-13  | currentTotalDeposit does not match needed shares  |            Backend             |
|  TT-YF-14  | Withdraw greater than deposit                     |            Backend             |
|  TT-YF-15  | currentTotalDeposit invalid                       |            Backend             |
|  TT-YF-16  | Shares invalid                                    |            Backend             |
| TT-LYG-01  | No yield to withdraw                              | User but controlled by backend |

[top](#error-codes)

## Others

| Error code | Description                          |           Trigger by           |
| :--------: | :----------------------------------- | :----------------------------: |
|  TT-CF-02  | Wrong state                          |            Backend             |
|  TT-CF-03  | Can’t empty yet                      |            Backend             |
|  TT-FF-03  | Can’t empty yet                      |            Backend             |
|  TT-GF-01  | Index out of bounds                  | User but controlled by backend |
|  TT-GF-02  | ChainlinkOracle: stale data          |           Chainlink            |
| TT-LTO-01  | TermOwnable: caller is not the owner |            Backend             |

[top](#error-codes)

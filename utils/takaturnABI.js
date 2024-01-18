const takaturnABI = [
    {
        inputs: [
            {
                internalType: "address",
                name: "_contractOwner",
                type: "address",
            },
            {
                components: [
                    {
                        internalType: "address",
                        name: "facetAddress",
                        type: "address",
                    },
                    {
                        internalType: "enum IDiamondCut.FacetCutAction",
                        name: "action",
                        type: "uint8",
                    },
                    {
                        internalType: "bytes4[]",
                        name: "functionSelectors",
                        type: "bytes4[]",
                    },
                ],
                internalType: "struct IDiamondCut.FacetCut[]",
                name: "_diamondCut",
                type: "tuple[]",
            },
            {
                components: [
                    {
                        internalType: "address",
                        name: "initContract",
                        type: "address",
                    },
                    {
                        internalType: "bytes",
                        name: "initData",
                        type: "bytes",
                    },
                ],
                internalType: "struct Diamond.Initialization[]",
                name: "_initializations",
                type: "tuple[]",
            },
        ],
        stateMutability: "payable",
        type: "constructor",
    },
    {
        stateMutability: "payable",
        type: "fallback",
    },
    {
        stateMutability: "payable",
        type: "receive",
    },
    {
        inputs: [],
        name: "FunctionInvalidAtThisState",
        type: "error",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "address",
                name: "user",
                type: "address",
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "OnCollateralLiquidated",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "enum LibCollateralStorage.CollateralStates",
                name: "oldState",
                type: "uint8",
            },
            {
                indexed: true,
                internalType: "enum LibCollateralStorage.CollateralStates",
                name: "newState",
                type: "uint8",
            },
        ],
        name: "OnCollateralStateChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "address",
                name: "user",
                type: "address",
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "collateralAmount",
                type: "uint256",
            },
        ],
        name: "OnCollateralWithdrawal",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "address",
                name: "user",
                type: "address",
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "OnFrozenMoneyPotLiquidated",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "address",
                name: "user",
                type: "address",
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "OnReimbursementWithdrawn",
        type: "event",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "emptyCollateralAfterEnd",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "releaseCollateral",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                components: [
                    {
                        internalType: "bool",
                        name: "initialized",
                        type: "bool",
                    },
                    {
                        internalType: "enum LibTermStorage.TermStates",
                        name: "state",
                        type: "uint8",
                    },
                    {
                        internalType: "address",
                        name: "termOwner",
                        type: "address",
                    },
                    {
                        internalType: "uint256",
                        name: "creationTime",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "termId",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "registrationPeriod",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "totalParticipants",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "cycleTime",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "contributionAmount",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "contributionPeriod",
                        type: "uint256",
                    },
                    {
                        internalType: "address",
                        name: "stableTokenAddress",
                        type: "address",
                    },
                ],
                internalType: "struct LibTermStorage.Term",
                name: "term",
                type: "tuple",
            },
            {
                internalType: "address[]",
                name: "defaulters",
                type: "address[]",
            },
        ],
        name: "requestContribution",
        outputs: [
            {
                internalType: "address[]",
                name: "",
                type: "address[]",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "withdrawCollateral",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "available",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "required",
                type: "uint256",
            },
        ],
        name: "InsufficientBalance",
        type: "error",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "address",
                name: "participant",
                type: "address",
            },
            {
                indexed: true,
                internalType: "bool",
                name: "enabled",
                type: "bool",
            },
        ],
        name: "OnAutoPayToggled",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "address",
                name: "beneficiary",
                type: "address",
            },
        ],
        name: "OnBeneficiaryAwarded",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "currentCycle",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "address",
                name: "expellant",
                type: "address",
            },
        ],
        name: "OnDefaulterExpelled",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "currentCycle",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "enum LibFundStorage.FundStates",
                name: "newState",
                type: "uint8",
            },
        ],
        name: "OnFundStateChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "address",
                name: "claimant",
                type: "address",
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "OnFundWithdrawn",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "address",
                name: "payer",
                type: "address",
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "currentCycle",
                type: "uint256",
            },
        ],
        name: "OnPaidContribution",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "currentCycle",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "address",
                name: "defaulter",
                type: "address",
            },
        ],
        name: "OnParticipantDefaulted",
        type: "event",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "closeFundingPeriod",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "emptyFundAfterEnd",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "payContribution",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "participant",
                type: "address",
            },
        ],
        name: "payContributionOnBehalfOf",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "startNewCycle",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "toggleAutoPay",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "withdrawFund",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "address",
                name: "user",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "OnCollateralDeposited",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "address",
                name: "termOwner",
                type: "address",
            },
        ],
        name: "OnTermCreated",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "OnTermExpired",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "OnTermFilled",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "OnTermStart",
        type: "event",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "totalParticipants",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "registrationPeriod",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "cycleTime",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "contributionAmount",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "contributionPeriod",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "stableTokenAddress",
                type: "address",
            },
        ],
        name: "createTerm",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "expireTerm",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                internalType: "bool",
                name: "optYield",
                type: "bool",
            },
        ],
        name: "joinTerm",
        outputs: [],
        stateMutability: "payable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "startTerm",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "user",
                type: "address",
            },
        ],
        name: "expelledBeforeBeneficiary",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "participant",
                type: "address",
            },
        ],
        name: "getAllJoinedTerms",
        outputs: [
            {
                internalType: "uint256[]",
                name: "",
                type: "uint256[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "getCollateralSummary",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
            {
                internalType: "enum LibCollateralStorage.CollateralStates",
                name: "",
                type: "uint8",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "address[]",
                name: "",
                type: "address[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "string",
                name: "firstAggregator",
                type: "string",
            },
            {
                internalType: "string",
                name: "secondAggregator",
                type: "string",
            },
            {
                internalType: "string",
                name: "zapAddress",
                type: "string",
            },
            {
                internalType: "string",
                name: "vaultAddress",
                type: "string",
            },
        ],
        name: "getConstants",
        outputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
            {
                internalType: "address",
                name: "",
                type: "address",
            },
            {
                internalType: "address",
                name: "",
                type: "address",
            },
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "getCurrentBeneficiary",
        outputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "depositor",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "getDepositorCollateralSummary",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "participant",
                type: "address",
            },
        ],
        name: "getExpelledTerms",
        outputs: [
            {
                internalType: "uint256[]",
                name: "",
                type: "uint256[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "getFundSummary",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
            {
                internalType: "enum LibFundStorage.FundStates",
                name: "",
                type: "uint8",
            },
            {
                internalType: "contract IERC20",
                name: "",
                type: "address",
            },
            {
                internalType: "address[]",
                name: "",
                type: "address[]",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "participant",
                type: "address",
            },
            {
                internalType: "enum LibTermStorage.TermStates",
                name: "state",
                type: "uint8",
            },
        ],
        name: "getJoinedTermsByState",
        outputs: [
            {
                internalType: "uint256[]",
                name: "",
                type: "uint256[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getLatestPrice",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "user",
                type: "address",
            },
        ],
        name: "getNeededAllowance",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "participant",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "getParticipantFundSummary",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "getRemainingContributionTime",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "getRemainingCycleTime",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "getRemainingCycles",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "getRemainingCyclesContributionWei",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "getRemainingRegistrationTime",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "getTermSummary",
        outputs: [
            {
                components: [
                    {
                        internalType: "bool",
                        name: "initialized",
                        type: "bool",
                    },
                    {
                        internalType: "enum LibTermStorage.TermStates",
                        name: "state",
                        type: "uint8",
                    },
                    {
                        internalType: "address",
                        name: "termOwner",
                        type: "address",
                    },
                    {
                        internalType: "uint256",
                        name: "creationTime",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "termId",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "registrationPeriod",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "totalParticipants",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "cycleTime",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "contributionAmount",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "contributionPeriod",
                        type: "uint256",
                    },
                    {
                        internalType: "address",
                        name: "stableTokenAddress",
                        type: "address",
                    },
                ],
                internalType: "struct LibTermStorage.Term",
                name: "",
                type: "tuple",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getTermsId",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "USDAmount",
                type: "uint256",
            },
        ],
        name: "getToCollateralConversionRate",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "ethAmount",
                type: "uint256",
            },
        ],
        name: "getToStableConversionRate",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "participant",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "getUserSet",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "user",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "getUserYieldSummary",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "user",
                type: "address",
            },
        ],
        name: "getWithdrawableUserBalance",
        outputs: [
            {
                internalType: "uint256",
                name: "allowedWithdrawal",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getYieldLockState",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "getYieldSummary",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "address[]",
                name: "",
                type: "address[]",
            },
            {
                internalType: "address",
                name: "",
                type: "address",
            },
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "beneficiary",
                type: "address",
            },
        ],
        name: "isBeneficiary",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "cycle",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "user",
                type: "address",
            },
        ],
        name: "isExempted",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "member",
                type: "address",
            },
        ],
        name: "isUnderCollaterized",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "depositorIndex",
                type: "uint256",
            },
        ],
        name: "minCollateralToDeposit",
        outputs: [
            {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "termAPY",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "totalYieldGenerated",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "user",
                type: "address",
            },
        ],
        name: "userAPY",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "user",
                type: "address",
            },
        ],
        name: "userHasoptedInYG",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "user",
                type: "address",
            },
        ],
        name: "wasExpelled",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "address",
                name: "user",
                type: "address",
            },
            {
                indexed: true,
                internalType: "bool",
                name: "optedIn",
                type: "bool",
            },
        ],
        name: "OnYGOptInToggled",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "address",
                name: "user",
                type: "address",
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "OnYieldClaimed",
        type: "event",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "claimAvailableYield",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                internalType: "address",
                name: "user",
                type: "address",
            },
        ],
        name: "claimAvailableYield",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
        ],
        name: "toggleOptInYG",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "toggleYieldLock",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "termId",
                type: "uint256",
            },
            {
                internalType: "string",
                name: "providerString",
                type: "string",
            },
            {
                internalType: "address",
                name: "providerAddress",
                type: "address",
            },
        ],
        name: "updateProviderAddressOnTerms",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "string",
                name: "providerString",
                type: "string",
            },
            {
                internalType: "address",
                name: "providerAddress",
                type: "address",
            },
        ],
        name: "updateYieldProvider",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        anonymous: false,
        inputs: [
            {
                components: [
                    {
                        internalType: "address",
                        name: "facetAddress",
                        type: "address",
                    },
                    {
                        internalType: "enum IDiamondCut.FacetCutAction",
                        name: "action",
                        type: "uint8",
                    },
                    {
                        internalType: "bytes4[]",
                        name: "functionSelectors",
                        type: "bytes4[]",
                    },
                ],
                indexed: false,
                internalType: "struct IDiamondCut.FacetCut[]",
                name: "_diamondCut",
                type: "tuple[]",
            },
            {
                indexed: false,
                internalType: "address",
                name: "_init",
                type: "address",
            },
            {
                indexed: false,
                internalType: "bytes",
                name: "_calldata",
                type: "bytes",
            },
        ],
        name: "DiamondCut",
        type: "event",
    },
    {
        inputs: [
            {
                components: [
                    {
                        internalType: "address",
                        name: "facetAddress",
                        type: "address",
                    },
                    {
                        internalType: "enum IDiamondCut.FacetCutAction",
                        name: "action",
                        type: "uint8",
                    },
                    {
                        internalType: "bytes4[]",
                        name: "functionSelectors",
                        type: "bytes4[]",
                    },
                ],
                internalType: "struct IDiamondCut.FacetCut[]",
                name: "_diamondCut",
                type: "tuple[]",
            },
            {
                internalType: "address",
                name: "_init",
                type: "address",
            },
            {
                internalType: "bytes",
                name: "_calldata",
                type: "bytes",
            },
        ],
        name: "diamondCut",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "previousOwner",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "newOwner",
                type: "address",
            },
        ],
        name: "OwnershipTransferred",
        type: "event",
    },
    {
        inputs: [],
        name: "owner",
        outputs: [
            {
                internalType: "address",
                name: "owner_",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_newOwner",
                type: "address",
            },
        ],
        name: "transferOwnership",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes4",
                name: "_functionSelector",
                type: "bytes4",
            },
        ],
        name: "facetAddress",
        outputs: [
            {
                internalType: "address",
                name: "facetAddress_",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "facetAddresses",
        outputs: [
            {
                internalType: "address[]",
                name: "facetAddresses_",
                type: "address[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_facet",
                type: "address",
            },
        ],
        name: "facetFunctionSelectors",
        outputs: [
            {
                internalType: "bytes4[]",
                name: "facetFunctionSelectors_",
                type: "bytes4[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "facets",
        outputs: [
            {
                components: [
                    {
                        internalType: "address",
                        name: "facetAddress",
                        type: "address",
                    },
                    {
                        internalType: "bytes4[]",
                        name: "functionSelectors",
                        type: "bytes4[]",
                    },
                ],
                internalType: "struct IDiamondLoupe.Facet[]",
                name: "facets_",
                type: "tuple[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes4",
                name: "_interfaceId",
                type: "bytes4",
            },
        ],
        name: "supportsInterface",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
]

module.exports = { takaturnABI }

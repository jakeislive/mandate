// Public records verified by scripts/snapshot-testnet.ts. No signing keys.
import type { TestnetSnapshot } from "./testnet-snapshot-types.ts";

export const snapshotData: TestnetSnapshot = {
  "schemaVersion": 1,
  "capturedAt": "2026-11-23T02:30:41.000Z",
  "ledger": 5875480,
  "network": "stellar:testnet",
  "rpcUrl": "https://soroban-testnet.stellar.org",
  "horizonUrl": "https://horizon-testnet.stellar.org",
  "explorerUrl": "https://stellar.expert/explorer/testnet",
  "asset": {
    "code": "USD",
    "contract": "CAF5YGTPPQFX3EYSEYTBI46CASCALCNPGQK3HYFQSPCBZVQKETQCMTJQ"
  },
  "accounts": [
    {
      "address": "CAJZQP2GAWMOWBF65MAVZ6VTY65QKENH6MUOISXA6QI3IGFKU6ZAZQ6S",
      "label": "Purchasing Smart Account",
      "balance": "72",
      "verifiedRecipient": true
    },
    {
      "address": "CCS3FRLJ7CX75NJWVNVVZ2TN6CPJTRCTMCD5SEQGP2KXGROFY6M5M5R2",
      "label": "Recipient Smart Account",
      "balance": "217",
      "verifiedRecipient": true
    }
  ],
  "mandates": [
    {
      "account": "CAJZQP2GAWMOWBF65MAVZ6VTY65QKENH6MUOISXA6QI3IGFKU6ZAZQ6S",
      "ruleId": 2,
      "name": "Chat mandate",
      "limit": "1",
      "spent": "0",
      "periodLedgers": 17280,
      "validUntilLedger": 6317913,
      "policies": [
        "CAVIDSIO5AX65326A4KEZMAOSJXNRIRLNKKQTSGJU2F4DF43GKKNUOJT",
        "CBR4M66YAZTBATCMGPOTYE2T5WAU6MKURKMOGF6VWSFCS757VPX6L2FZ"
      ],
      "signerPublicKeys": [
        "GDAD4EV3PCDXPIJTMVRL6D4IU6TC2W6F64ZFAIP5MMUFWX7VGK4V2Z2W"
      ],
      "approvedSellers": null
    },
    {
      "account": "CAJZQP2GAWMOWBF65MAVZ6VTY65QKENH6MUOISXA6QI3IGFKU6ZAZQ6S",
      "ruleId": 3,
      "name": "Software seats",
      "limit": "40",
      "spent": "0",
      "periodLedgers": 17280,
      "validUntilLedger": 5920477,
      "policies": [
        "CAVIDSIO5AX65326A4KEZMAOSJXNRIRLNKKQTSGJU2F4DF43GKKNUOJT",
        "CBR4M66YAZTBATCMGPOTYE2T5WAU6MKURKMOGF6VWSFCS757VPX6L2FZ"
      ],
      "signerPublicKeys": [
        "GBFMW4HQJEIYAGCOJT23X5W3LIXBHMH5HWDG72CBKOZ55SAQOXCRFG3Y"
      ],
      "approvedSellers": [
        "CCS3FRLJ7CX75NJWVNVVZ2TN6CPJTRCTMCD5SEQGP2KXGROFY6M5M5R2"
      ]
    }
  ],
  "transactions": [
    {
      "hash": "e251996cdcfbcac84195996d71ed5e7c9ef834f7b17f7a4312eea94a3fa0d2d3",
      "from": "CAJZQP2GAWMOWBF65MAVZ6VTY65QKENH6MUOISXA6QI3IGFKU6ZAZQ6S",
      "to": "CCS3FRLJ7CX75NJWVNVVZ2TN6CPJTRCTMCD5SEQGP2KXGROFY6M5M5R2",
      "amount": "15",
      "ledger": 5799522,
      "closedAt": "2026-11-18T17:00:49Z",
      "ruleId": 3,
      "successful": true
    },
    {
      "hash": "3ead1926357a75b15cbf0278b137598f95db8f5b9f092749b0af7a523e29fb67",
      "from": "CAJZQP2GAWMOWBF65MAVZ6VTY65QKENH6MUOISXA6QI3IGFKU6ZAZQ6S",
      "to": "CCS3FRLJ7CX75NJWVNVVZ2TN6CPJTRCTMCD5SEQGP2KXGROFY6M5M5R2",
      "amount": "12",
      "ledger": 5799521,
      "closedAt": "2026-11-18T17:00:44Z",
      "ruleId": 3,
      "successful": true
    },
    {
      "hash": "10532a2f934551836d42a2be16edf9c148fcd9cceb1d8dc3b2cecac199c09d4c",
      "from": "CAJZQP2GAWMOWBF65MAVZ6VTY65QKENH6MUOISXA6QI3IGFKU6ZAZQ6S",
      "to": "CCS3FRLJ7CX75NJWVNVVZ2TN6CPJTRCTMCD5SEQGP2KXGROFY6M5M5R2",
      "amount": "1",
      "ledger": 5799520,
      "closedAt": "2026-11-18T17:00:39Z",
      "ruleId": 3,
      "successful": true
    }
  ]
};

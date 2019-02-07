const { TextEncoder, TextDecoder } = require('text-encoding'); // node only; native TextEncoder/Decoder
const core = require('gls-core-service');
const fetch = require('node-fetch'); // node only; not needed in browsers
const { JsonRpc, Api } = require('cyberwayjs');
const JsSignatureProvider = require('cyberwayjs/dist/eosjs-jssig').default;
const BasicService = core.services.Basic;
const env = require('../data/env');
const {
    CMN_PROVIDER_WIF,
    CMN_PROVIDER_PUBLIC_KEY,
    CMN_PROVIDER_USERNAME,
    CMN_CYBERWAY_HTTP_URL,
} = env;

const rpc = new JsonRpc(CMN_CYBERWAY_HTTP_URL, { fetch });

const requiredKeys = [CMN_PROVIDER_PUBLIC_KEY];
const signatureProviderBP = new JsSignatureProvider([CMN_PROVIDER_WIF]);

const api = new Api({
    rpc,
    signatureProviderBP,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder(),
});

class BandwidthProvider extends BasicService {
    constructor({ whitelist }) {
        super();

        this.whitelist = whitelist;
    }

    start() {
        // do nothing, just override default
    }

    async _signTransaction({ transaction, chainId }) {
        const transactionBW = await signatureProviderBP.sign({
            chainId,
            requiredKeys,
            serializedTransaction: transaction.serializedTransaction,
        });

        const transactionBoth = {
            ...transaction,
            signatures: [...transaction.signatures, ...transactionBW.signatures],
            serializedTransaction: transaction.serializedTransaction,
        };

        const { signatures, serializedTransaction } = transactionBoth;

        return { signatures, serializedTransaction };
    }

    async _sendTransaction({ signatures, serializedTransaction }) {
        return await api.pushSignedTransaction({
            signatures,
            serializedTransaction,
        });
    }

    async provideBandwidth({
        routing: { channelId },
        auth: { user },
        params: { transaction, chainId },
    }) {
        const isAllowed = await this.whitelist.isAllowed({ channelId, user });

        if (!isAllowed) {
            throw {
                code: 1103,
                message: 'This user is not allowed to require bandwidth',
            };
        }

        const serializedTransactionBuffer = Uint8Array.from(transaction.serializedTransaction);
        transaction.serializedTransaction = serializedTransactionBuffer;

        const deserializedTransaction = await api.deserializeTransactionWithActions(
            transaction.serializedTransaction
        );

        const shouldProvideBandwidth = deserializedTransaction.actions.find(action => {
            return action.name === 'providebw' && action.data.provider === CMN_PROVIDER_USERNAME;
        });

        let transactionToSend = transaction;

        if (shouldProvideBandwidth) {
            transactionToSend = await this._signTransaction({ transaction, chainId });
        }

        return await this._sendTransaction(transactionToSend);
    }
}

module.exports = BandwidthProvider;

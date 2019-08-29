const { TextEncoder, TextDecoder } = require('text-encoding');
const core = require('gls-core-service');
const fetch = require('node-fetch');
const { JsonRpc, Api, Serialize } = require('cyberwayjs');
const JsSignatureProvider = require('cyberwayjs/dist/eosjs-jssig').default;
const BasicController = core.controllers.Basic;
const Logger = core.utils.Logger;
const env = require('../data/env');
const Log = require('../utils/Log');
const {
    GLS_PROVIDER_WIF,
    GLS_PROVIDER_PUBLIC_KEY,
    GLS_PROVIDER_USERNAME,
    GLS_CYBERWAY_HTTP_URL,
} = env;

const rpc = new JsonRpc(GLS_CYBERWAY_HTTP_URL, { fetch });

const requiredKeys = [GLS_PROVIDER_PUBLIC_KEY];
const signatureProviderBP = new JsSignatureProvider([GLS_PROVIDER_WIF]);

const api = new Api({
    rpc,
    signatureProviderBP,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder(),
});

class BandwidthProvider extends BasicController {
    constructor({ whitelist }) {
        super();

        this._whitelist = whitelist;
        this._logger = new Log();
    }

    async provideBandwidth({
        routing: { channelId },
        auth: { user },
        params: { transaction, chainId },
    }) {
        try {
            const rawTrx = this._parseTransaction(transaction);
            const trx = await this._deserializeTransaction(rawTrx);
            const isNeedSign = this._isNeedSigning(trx);

            let finalTrx = rawTrx;

            if (isNeedSign) {
                await this._checkWhitelist({ user, channelId });
                finalTrx = await this._signTransaction(rawTrx, { chainId });
            }

            this._logEntry({ user, transaction: trx, isSigned: isNeedSign });

            return await this._sendTransaction(finalTrx);
        } catch (error) {
            if (error.json && error.json.error && error.json.error.details) {
                throw {
                    code: 500,
                    message: JSON.stringify(error.json.error.details[0]),
                };
            }

            throw {
                code: 500,
                message: 'Failed to transact -- ' + error,
            };
        }
    }

    _parseTransaction(transaction) {
        let uint8array = null;

        try {
            uint8array = Serialize.hexToUint8Array(transaction.serializedTransaction);
        } catch (error) {
            Logger.error('Conversion hexToUint8Array failed:', error);
            throw error;
        }

        return {
            ...transaction,
            serializedTransaction: uint8array,
        };
    }

    async _deserializeTransaction({ serializedTransaction }) {
        try {
            return await api.deserializeTransactionWithActions(serializedTransaction);
        } catch (error) {
            Logger.error('Transaction deserialization failed:', error);
            throw error;
        }
    }

    _isNeedSigning({ actions }) {
        const provideBwAction = actions.find(
            ({ account, name, authorization, data }) =>
                account === 'cyber' &&
                name === 'providebw' &&
                authorization.length === 1 &&
                authorization[0].actor === GLS_PROVIDER_USERNAME &&
                authorization[0].permission === 'providebw' &&
                data.provider === GLS_PROVIDER_USERNAME
        );

        if (!provideBwAction) {
            return false;
        }

        for (const action of actions) {
            if (action === provideBwAction) {
                continue;
            }

            for (const { actor } of action.authorization) {
                // Проверяем все экшены, чтобы исключить возможность подписи нашим ключом экшенов кроме providebw
                // Если находим такой экшен, то выдаем ошибку.
                if (actor === GLS_PROVIDER_USERNAME) {
                    throw {
                        code: 1104,
                        message:
                            'Transaction contains action with provider as actor except providebw action',
                    };
                }
            }
        }

        return true;
    }

    async _checkWhitelist({ channelId, user }) {
        let isAllowed = false;
        try {
            isAllowed = await this._whitelist.isAllowed({ channelId, user });
        } catch (error) {
            Logger.error('Whitelist check failed:', JSON.stringify(error, null, 4));
            throw error;
        }

        if (!isAllowed) {
            throw {
                code: 1103,
                message: 'This user is not allowed to require bandwidth',
            };
        }
    }

    async _signTransaction({ signatures, serializedTransaction }, { chainId }) {
        try {
            const transactionBW = await signatureProviderBP.sign({
                chainId,
                requiredKeys,
                serializedTransaction,
            });

            return {
                signatures: [...signatures, ...transactionBW.signatures],
                serializedTransaction,
            };
        } catch (error) {
            Logger.error('Transaction sign failed:', JSON.stringify(error, null, 4));
            throw error;
        }
    }

    _logEntry({ user, transaction, isSigned }) {
        try {
            this._logger.createEntry({
                transaction,
                user,
                providedBandwidth: isSigned,
            });
        } catch (error) {
            Logger.error('Logger entry creation failed:', error);
        }
    }

    async _sendTransaction({ signatures, serializedTransaction }) {
        try {
            return await api.pushSignedTransaction({
                signatures,
                serializedTransaction,
            });
        } catch (error) {
            Logger.error('Transaction send failed:', error);
            throw error;
        }
    }
}

module.exports = BandwidthProvider;

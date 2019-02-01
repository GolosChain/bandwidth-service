const core = require('gls-core-service');
const Basic = core.controllers.Basic;
const env = require('../data/env');
const { GLS_PROVIDER_WIF, GLS_PROVIDER_USERNAME } = env;

class BandwidthProvider extends Basic {
    constructor({ connector, whitelist }) {
        super({ connector });

        this.whitelist = whitelist;

        // we cannot use the service until it's authorized in blockchain
        this._authorized = false;

        // these are null by default
        this._sign = null;
        this._secret = null;
    }

    get serviceReady() {
        // service is ready when and only then there it is authorized and has not-null secret and sign
        return this._authorized && this._secret && this._sign;
    }

    async authorize() {
        try {
            // first call `auth.generateSecret`
            const secret = '';
            // store the given secret
            this._secret = secret;
            // secondly, sign the test vote transaction with the secret as a permlink and a user as a voter and the active key
            // store the xsign
            const xsign = '';
            this._sign = xsign;
            // send `auth.authorize` request with a secret as a secret, xsign as a sign and user from env as a user

            this._authorized = true;
        } catch (error) {
            console.error(error);
            process.exit(1);
        }
    }

    async provideBandwidth({ user, channelId, transaction }) {
        if (!this.serviceReady) {
            await this.authorize();
        }

        const isAllowed = await this.whitelist.isAllowed({ channelId, user });

        if (!isAllowed) {
            throw {
                code: 1103,
                message: 'This user is not allowed to require bandwidth',
            };
        }

        /*
        Контракт: eosio
Действие: providebw
Аргументы: (name provider, name account):
* provider - аккаунт, который предоставляет свой бендвич для выполнения транзакции
* account - аккаунт пользователя, которому предоставляется бендвич

Выполняемое действие:
Предоставить бендвич для выполнения действий другому пользователю. При включении данного действия в транзакцию, CPU/NET бендвич за действия в данной транзакции будут списаны с аккаунты provider вместо их списания с аккаунта account.

Данная операция требует разрешения от пользователя provider.

Данная операция сейчас доступна на тестнете cyberway, но пока не запущен системный смарт-контракт ее действие невозможно увидеть, так как выключен подсчет бендвича.
        */
    }
}

module.exports = BandwidthProvider;

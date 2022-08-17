const {
    LambdaClient,
    GetFunctionConfigurationCommand,
    UpdateFunctionConfigurationCommand,
} = require('@aws-sdk/client-lambda');
const chalk = require('chalk');

const PLUGIN_NAME = 'serverless-instana-wrapper';
const AUTO_WRAP_HANDLER = 'instana-aws-lambda-auto-wrap.handler';

class InstanaWrapperPlugin {
    constructor(serverless) {
        this.serverless = serverless;
        this.hooks = {
            'after:deploy:deploy': this.configureInstanaAutoWrap.bind(this),
        };
    }

    logError(message) {
        this.serverless.cli.log(`${chalk.bold.red('ERROR: ')}${message}`, PLUGIN_NAME);
    }

    logInfo(message) {
        this.serverless.cli.log(`${chalk.bold.blue('INFO: ')}${message}`, PLUGIN_NAME);
    }

    async getLambdaConfig(lambdaClient, functionName) {
        try {
            return await lambdaClient.send(
                new GetFunctionConfigurationCommand({
                    FunctionName: functionName,
                })
            );
        } catch (err) {
            this.logError(`Failed to get lambda config for: ${functionName}. ${err.message}`);
            throw err;
        }
    }

    async updateLambdaConfig(lambdaClient, functionName, handler, envVariables) {
        if (handler === AUTO_WRAP_HANDLER) {
            if (envVariables.LAMBDA_HANDLER) {
                this.logInfo(`Instana already configured for function: ${functionName}`);
                return;
            }
            this.logError(
                `Handler already pointing at Instana layer for function '${functionName}' but 'LAMBDA_HANDLER' environment variable is missing. Was this function manually configured?`
            );
            throw new Error('Missing LAMBDA_HANDLER variable');
        }

        const combinedEnvVars = envVariables
            ? { ...envVariables, LAMBDA_HANDLER: handler }
            : { LAMBDA_HANDLER: handler };

        try {
            this.logInfo(`Updating config for function: ${functionName}`);
            await lambdaClient.send(
                new UpdateFunctionConfigurationCommand({
                    FunctionName: functionName,
                    Environment: { Variables: { ...combinedEnvVars } },
                    Handler: AUTO_WRAP_HANDLER,
                })
            );
        } catch (err) {
            this.logError(`Failed to update lambda config for: ${functionName}. ${err.message}`);
            throw err;
        }
    }

    async configureInstanaAutoWrap() {
        if (!this.serverless?.service?.functions) {
            this.logInfo('No functions found in serverless file');
            return;
        }

        const lambdaClient = new LambdaClient({
            region: this.serverless.service.provider.region,
            maxAttempts: 10,
        });

        const promiseArray = [];
        Object.entries(this.serverless.service.functions).map(([, { name }]) =>
            promiseArray.push(this.getLambdaConfig(lambdaClient, name))
        );

        const lambdaFunctions = await Promise.all(promiseArray);

        await Promise.all(
            lambdaFunctions.map(({ FunctionName, Handler, Environment }) =>
                this.updateLambdaConfig(lambdaClient, FunctionName, Handler, Environment?.Variables)
            )
        );

        this.logInfo('All functions updated successfully!');
    }
}

module.exports = InstanaWrapperPlugin;

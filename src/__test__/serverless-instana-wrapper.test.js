/* eslint-disable class-methods-use-this */
const { mockClient } = require('aws-sdk-client-mock');
const {
    LambdaClient,
    GetFunctionConfigurationCommand,
    UpdateFunctionConfigurationCommand,
} = require('@aws-sdk/client-lambda');
const InstanaWrapperPlugin = require('../serverless-instana-wrapper');

const AUTO_WRAP_HANDLER = 'instana-aws-lambda-auto-wrap.handler';
const serverlessConfig = {
    service: {
        provider: {
            region: 'eu-west-2',
        },
    },

    cli: {
        log: jest.fn(),
    },
};
const plugin = new InstanaWrapperPlugin(serverlessConfig);

const lambdaMock = mockClient(LambdaClient);

beforeEach(() => {
    lambdaMock.reset();
    lambdaMock.on(GetFunctionConfigurationCommand).resolves({ FunctionName: 'test-funct' });
    lambdaMock.on(UpdateFunctionConfigurationCommand).resolves({ FunctionName: 'test-funct' });

    jest.clearAllMocks();
    jest.spyOn(plugin, 'logError');
    jest.spyOn(plugin, 'logInfo');

    plugin.serverless = serverlessConfig;
});

describe('getLambdaConfig', () => {
    it('correctly calls getFunctionConfiguration', async () => {
        await expect(plugin.getLambdaConfig(lambdaMock, 'test-function')).resolves.toEqual({
            FunctionName: 'test-funct',
        });

        expect(lambdaMock.calls()).toHaveLength(1);

        const request = lambdaMock.call(0);
        expect(request.args[0].input).toEqual({
            FunctionName: 'test-function',
        });
    });

    it('throws an error on failure', async () => {
        const error = new Error('Bad thing');
        lambdaMock.on(GetFunctionConfigurationCommand).rejects(error);

        await expect(plugin.getLambdaConfig(lambdaMock, 'test-function')).rejects.toEqual(error);

        expect(lambdaMock.calls()).toHaveLength(1);

        const request = lambdaMock.call(0);
        expect(request.args[0].input).toEqual({
            FunctionName: 'test-function',
        });
        expect(plugin.logError.mock.calls[0][0]).toEqual('Failed to get lambda config for: test-function. Bad thing');
    });
});

describe('updateLambdaConfig', () => {
    it('correctly calls updateFunctionConfiguration and retains environment variables', async () => {
        const envVariable = {
            TEST_VARIABLE_1: 'test1',
            TEST_VARIABLE_2: 'test2',
        };
        await plugin.updateLambdaConfig(lambdaMock, 'test-function', 'my-handler', envVariable);

        expect(lambdaMock.calls()).toHaveLength(1);
        const request = lambdaMock.call(0);
        expect(request.args[0].input).toEqual({
            Environment: {
                Variables: {
                    LAMBDA_HANDLER: 'my-handler',
                    ...envVariable,
                },
            },
            FunctionName: 'test-function',
            Handler: 'instana-aws-lambda-auto-wrap.handler',
        });
    });

    it('does not update function when handler is already set', async () => {
        const envVariable = {
            TEST_VARIABLE_1: 'test1',
            TEST_VARIABLE_2: 'test2',
            LAMBDA_HANDLER: 'my-handler',
        };
        await plugin.updateLambdaConfig(lambdaMock, 'test-function', AUTO_WRAP_HANDLER, envVariable);
        expect(lambdaMock.calls()).toHaveLength(0);
        expect(plugin.logInfo.mock.calls[0][0]).toEqual('Instana already configured for function: test-function');
    });

    it('throws error when handler is set without environment variable', async () => {
        const envVariable = {
            TEST_VARIABLE_1: 'test1',
            TEST_VARIABLE_2: 'test2',
        };
        await expect(
            plugin.updateLambdaConfig(lambdaMock, 'test-function', AUTO_WRAP_HANDLER, envVariable)
        ).rejects.toThrow(new Error('Missing LAMBDA_HANDLER variable'));
        expect(lambdaMock.calls()).toHaveLength(0);
        expect(plugin.logError.mock.calls[0][0]).toEqual(
            "Handler already pointing at Instana layer for function 'test-function' but 'LAMBDA_HANDLER' environment variable is missing. Was this function manually configured?"
        );
    });

    it('throws an error on failure', async () => {
        const error = new Error('Bad thing');
        lambdaMock.on(UpdateFunctionConfigurationCommand).rejects(error);
        await expect(plugin.updateLambdaConfig(lambdaMock, 'test-function', 'test-handler')).rejects.toEqual(error);
        expect(lambdaMock.calls()).toHaveLength(1);
        expect(plugin.logError.mock.calls[0][0]).toEqual(
            'Failed to update lambda config for: test-function. Bad thing'
        );
    });
});

describe('configureInstanaAutoWrap', () => {
    it('correctly calls helper functions for multiple lambdas', async () => {
        const configWithLambdas = JSON.parse(JSON.stringify(serverlessConfig));
        configWithLambdas.service.functions = {
            'function-one': { name: 'function-one-name' },
            'function-two': { name: 'function-two-name' },
        };
        configWithLambdas.cli.log = jest.fn();
        plugin.serverless = configWithLambdas;

        lambdaMock
            .on(GetFunctionConfigurationCommand)
            .resolvesOnce({
                FunctionName: 'function-one-name',
                Handler: 'handler-one',
                Environment: { Variables: { TEST_VARIABLE_1: 'test1' } },
            })
            .resolves({
                FunctionName: 'function-two-name',
                Handler: 'handler-two',
                Environment: { Variables: { TEST_VARIABLE_2: 'test2' } },
            });

        jest.spyOn(plugin, 'getLambdaConfig');
        jest.spyOn(plugin, 'updateLambdaConfig');

        await plugin.configureInstanaAutoWrap();

        expect(plugin.getLambdaConfig).toHaveBeenCalledTimes(2);
        const getRequests = lambdaMock.commandCalls(GetFunctionConfigurationCommand);
        expect(getRequests[0].args[0].input).toEqual({
            FunctionName: 'function-one-name',
        });
        expect(getRequests[1].args[0].input).toEqual({
            FunctionName: 'function-two-name',
        });

        expect(plugin.updateLambdaConfig).toHaveBeenCalledTimes(2);
        const updateRequests = lambdaMock.commandCalls(UpdateFunctionConfigurationCommand);
        expect(updateRequests[0].args[0].input).toEqual({
            Environment: {
                Variables: {
                    LAMBDA_HANDLER: 'handler-one',
                    TEST_VARIABLE_1: 'test1',
                },
            },
            FunctionName: 'function-one-name',
            Handler: 'instana-aws-lambda-auto-wrap.handler',
        });
        expect(updateRequests[0].args[0].input).toEqual({
            Environment: {
                Variables: {
                    LAMBDA_HANDLER: 'handler-one',
                    TEST_VARIABLE_1: 'test1',
                },
            },
            FunctionName: 'function-one-name',
            Handler: 'instana-aws-lambda-auto-wrap.handler',
        });
    });

    it('does nothing when no functions exist', async () => {
        jest.spyOn(plugin, 'getLambdaConfig');
        jest.spyOn(plugin, 'updateLambdaConfig');

        await plugin.configureInstanaAutoWrap();

        expect(plugin.getLambdaConfig).toHaveBeenCalledTimes(0);
        expect(plugin.updateLambdaConfig).toHaveBeenCalledTimes(0);
    });
});

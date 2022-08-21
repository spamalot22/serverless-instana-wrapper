# Serverless Instana Wrapper plugin

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com) ![GitHub Workflow Status](https://img.shields.io/github/workflow/status/spamalot22/serverless-instana-wrapper/CI) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=spamalot22_serverless-instana-wrapper&metric=bugs)](https://sonarcloud.io/summary/new_code?id=spamalot22_serverless-instana-wrapper) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=spamalot22_serverless-instana-wrapper&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=spamalot22_serverless-instana-wrapper) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=spamalot22_serverless-instana-wrapper&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=spamalot22_serverless-instana-wrapper) [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=spamalot22_serverless-instana-wrapper&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=spamalot22_serverless-instana-wrapper)

Automatically update your lambda's handler post-deploy to use the [Instana AutoTrace layer.](https://www.instana.com/docs/ecosystem/aws-lambda/nodejs/#instana-autotrace-setup)

## Installation

From your serverless project folder run:

`npm install serverless-instana-wrapper -D`

Add the plugin to your serverless.yml:

```yaml
plugins:
  - serverless-instana-wrapper
```

## Configuration

The Instana lambda layer must be added to each function config before this plugin will work. To configure it for all functions in the stack, add the following under the 'provider' section of your serverless file and replace 'XX' with the desired version of the layer. You will still be required to periodically update the layer's version number to take advantage of any new features.

```yaml
layers: 
    arn:aws:lambda:eu-west-2:410797082306:layer:instana-nodejs:XX
```

View a list of Instana lambda layer versions [here](https://www.ibm.com/docs/en/instana-observability/current?topic=kinesis-aws-lambda-native-tracing-nodejs#instana-lambda-layers)

**NOTE:** The above ARN is for eu-west-2, a full list of ARNs for the layer can be found [here.](https://www.instana.com/docs/ecosystem/aws-lambda/nodejs/#instana-lambda-layers)

The following environment variables must also be added to the provider or specific function section of your serverless file:

```yaml
environment:
    INSTANA_ENDPOINT_URL: https://serverless-blue-saas.instana.io
    INSTANA_AGENT_KEY: ************
    # Optional extra headers to add to traces for projects utilising API Gateway
    INSTANA_EXTRA_HTTP_HEADERS: X-Custom-Header-One;X-Custom-Header-Two
```

You **MUST NOT** change the 'handler' reference for your function(s) as per Instana's documentation, you should leave these pointed at your own code and this plugin will switch it for you. There is also no need to install the `@instana/lambda` NPM module or make any changes to your function's code.

## Why is it needed?

Due to how the serverless framework packages functions, the lambda handler reference cannot point to code external to your project's code (i.e. a lambda layer). There are ways around this but if you are using serverless-webpack, the problem gets worse and requires a manual step after deployment.
This plugin addresses that issue by retrieving the lambda handler's reference and adding it to a `LAMBDA_HANDLER` environment variable in your function(s). The original handler reference will then be replaced with `instana-aws-lambda-auto-wrap.handler` to activate the layer.

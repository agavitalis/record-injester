import * as Joi from 'joi';
import * as dotenv from 'dotenv';

process.env.ENV_PATH
  ? dotenv.config({ path: process.env.ENV_PATH })
  : dotenv.config();

const envSchema = Joi.object({
  PORT: Joi.number().required(),
  NODE_ENV: Joi.string().valid('dev', 'staging', 'production').required(),
})
  .unknown()
  .required();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  //throw new Error(`ENV Configuration error: \n${error.message}`);
}

export const config = {
  IS_DEVELOPMENT:
    envVars.NODE_ENV === 'dev' || envVars.NODE_ENV === 'staging' ? true : false,
  IS_LOCALHOST: envVars.NODE_ENV === 'dev' ? true : false,
  PORT: envVars.PORT,
  NODE_ENV: envVars.NODE_ENV,
  DB_PORT: envVars.DB_PORT,
  DB_USERNAME: envVars.DB_USERNAME,
  DB_PASSWORD: envVars.DB_PASSWORD,
  DB_NAME: envVars.DB_NAME,

  // Rabbit MQ Env
  RABBITMQ_URL: envVars.RABBITMQ_URL,
  RABBITMQ_NOTIFICATION_CLIENT: envVars.RABBITMQ_NOTIFICATION_CLIENT,
  RABBITMQ_NOTIFICATION_QUEUE: envVars.RABBITMQ_NOTIFICATION_QUEUE,
};

import * as Joi from 'joi';
import * as dotenv from 'dotenv';

process.env.ENV_PATH ? dotenv.config({ path: process.env.ENV_PATH }) : dotenv.config();

const envSchema = Joi.object({
  PORT: Joi.number().required(),
  NODE_ENV: Joi.string().valid('dev', 'staging', 'production').required(),
})
  .unknown()
  .required();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const Env = {
  NODE_ENV: envVars.NODE_ENV,

  IS_DEVELOPMENT: envVars.NODE_ENV === 'dev' || envVars.NODE_ENV === 'staging' ? true : false,
  IS_LOCALHOST: envVars.NODE_ENV === 'dev' ? true : false,
 
  PORT: envVars.PORT,
  BASE_URL: envVars.BASE_URL,
  DB_URL: envVars.DB_URL,

  AUTO_WIDEN_ON_TYPE_ERRORS: /^true$/i.test(String(envVars.AUTO_WIDEN_ON_TYPE_ERRORS)),

  SOURCE_URLS: String(envVars.SOURCE_URLS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
};


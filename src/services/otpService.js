const crypto = require('crypto');
const { client } = require('../config/redis');
const { sendOtpEmail } = require('./emailService');

const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 300);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_REQUEST_COOLDOWN_SECONDS = Number(process.env.OTP_REQUEST_COOLDOWN_SECONDS || 60);

const otpKey = (email) => `otp:${email}`;
const attemptsKey = (email) => `otp:${email}:attempts`;
const cooldownKey = (email) => `otp:${email}:cooldown`;

function generateOtp() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

async function requestOtp(email) {
  const onCooldown = await client.get(cooldownKey(email));
  if (onCooldown) {
    const ttl = await client.ttl(cooldownKey(email));
    const error = new Error(`Please wait ${ttl}s before requesting another code.`);
    error.code = 'COOLDOWN';
    throw error;
  }

  const otp = generateOtp();

  await client.set(otpKey(email), otp, { EX: OTP_TTL_SECONDS });
  await client.del(attemptsKey(email));
  await client.set(cooldownKey(email), '1', { EX: OTP_REQUEST_COOLDOWN_SECONDS });

  await sendOtpEmail(email, otp);
}

async function verifyOtp(email, submittedOtp) {
  const storedOtp = await client.get(otpKey(email));

  if (!storedOtp) {
    const error = new Error('Code expired or not found. Request a new one.');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const attempts = await client.incr(attemptsKey(email));
  if (attempts === 1) {
    await client.expire(attemptsKey(email), OTP_TTL_SECONDS);
  }

  if (attempts > OTP_MAX_ATTEMPTS) {
    await client.del(otpKey(email));
    await client.del(attemptsKey(email));
    const error = new Error('Too many attempts. Request a new code.');
    error.code = 'TOO_MANY_ATTEMPTS';
    throw error;
  }

  if (storedOtp !== submittedOtp) {
    const error = new Error('Incorrect code.');
    error.code = 'INVALID';
    throw error;
  }

  await client.del(otpKey(email));
  await client.del(attemptsKey(email));
}

module.exports = { requestOtp, verifyOtp };

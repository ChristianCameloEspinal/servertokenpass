import client from '../utils/twilioClient';
/**
 * Envia la verificación al número de teléfono proporcionado
 * @param phone - Phone number to send the verification code to
 * @returns 
 */
const sendVerification = async (phone: string) => {
  return await client.verify.v2
    .services(process.env.TWILIO_SERVICE_SID!)
    .verifications.create({
      to: phone,
      channel: 'sms',
    });
};

const checkVerification = async (phone: string, code: string) => {
    return await client.verify.v2
      .services(process.env.TWILIO_SERVICE_SID!)
      .verificationChecks.create({
        to: phone,
        code,
      });
  };
  
export { sendVerification, checkVerification };
import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';

export const razorpayWebhook = async (request: Request, response: Response) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET as string;

    try {
        // Verify webhook signature
        const signature = request.headers['x-razorpay-signature'] as string;
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(request.body))
            .digest('hex');

        if (signature !== expectedSignature) {
            console.log('⚠️ Webhook signature verification failed.');
            return response.sendStatus(400);
        }

        // Handle the event
        switch (request.body.event) {
            case 'payment_link.paid':
                const { transactionId, appId } = request.body.payload.payment_link.entity.notes as {
                    transactionId: string;
                    appId: string;
                };

                if (appId === 'ai-site-builder' && transactionId) {
                    const transaction = await prisma.transaction.update({
                        where: { id: transactionId },
                        data: { isPaid: true }
                    });

                    // Add credits to user
                    await prisma.user.update({
                        where: { id: transaction.userId },
                        data: { credits: { increment: transaction.credits } }
                    });
                }
                break;

            default:
                console.log(`Unhandled event type: ${request.body.event}`);
        }

        response.json({ received: true });

    } catch (err: any) {
        console.log('Webhook error:', err.message);
        return response.sendStatus(500);
    }
}
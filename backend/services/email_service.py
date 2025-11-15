import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

def send_otp_email(user_email, user_name, otp_code, simulation_name):
    """
    Send OTP verification email
    Configure with your SMTP provider (Gmail, SendGrid, AWS SES, etc.)
    """
    
    sender_email = os.getenv('SMTP_EMAIL')
    sender_password = os.getenv('SMTP_PASSWORD')
    smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    
    # Create message
    message = MIMEMultipart("alternative")
    message["Subject"] = "UrbanFlow - Publishing Verification Code"
    message["From"] = sender_email
    message["To"] = user_email
    
    # HTML email template
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">UrbanFlow</h1>
          <p style="color: white; margin: 5px 0;">Traffic Simulation System</p>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <h2 style="color: #1f2937;">Hello {user_name},</h2>
          
          <p style="color: #4b5563; line-height: 1.6;">
            You're about to publish the simulation <strong>"{simulation_name}"</strong> to the public map.
          </p>
          
          <div style="background: white; border: 2px solid #f97316; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px;">Your verification code is:</p>
            <h1 style="color: #f97316; font-size: 48px; letter-spacing: 8px; margin: 10px 0;">
              {otp_code}
            </h1>
            <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 12px;">
              This code expires in 10 minutes
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            If you didn't request this code, please ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            UrbanFlow - Calamba City Traffic Prediction System<br>
            © 2025 All rights reserved
          </p>
        </div>
      </body>
    </html>
    """
    
    part = MIMEText(html, "html")
    message.attach(part)
    
    # Send email
    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, user_email, message.as_string())
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False
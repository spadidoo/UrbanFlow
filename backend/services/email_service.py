import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os


# Add these configuration variables at the top of your file
EMAIL_HOST = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('SMTP_PORT', 587))  # Fixed: Changed from 'SMTP_SERVER' to 'SMTP_PORT'
EMAIL_USER = os.getenv('SMTP_EMAIL')
EMAIL_PASSWORD = os.getenv('SMTP_PASSWORD')
EMAIL_FROM = os.getenv('SMTP_EMAIL', EMAIL_USER)


def send_otp_email(recipient_email, recipient_name, otp_code, expires_minutes=10):
    """
    Send OTP verification email
    """
    try:
        # Verify environment variables are loaded
        if not EMAIL_USER or not EMAIL_PASSWORD:
            raise Exception("Email credentials not configured. Check .env file.")
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'UrbanFlow - Publish Verification Code'
        msg['From'] = EMAIL_FROM
        msg['To'] = recipient_email
        
        # Create HTML email body
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }}
                .otp-box {{ background-color: white; border: 2px dashed #2563eb; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }}
                .otp-code {{ font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 5px; }}
                .warning {{ color: #dc2626; font-size: 14px; margin-top: 20px; }}
                .footer {{ text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚦 UrbanFlow</h1>
                    <p>Traffic Simulation Verification</p>
                </div>
                <div class="content">
                    <h2>Hello {recipient_name},</h2>
                    <p>You requested to publish a traffic disruption simulation. Please use the verification code below to confirm:</p>
                    
                    <div class="otp-box">
                        <p style="margin: 0; color: #6b7280;">Your Verification Code</p>
                        <div class="otp-code">{otp_code}</div>
                        <p style="margin: 10px 0 0 0; color: #6b7280;">Valid for {expires_minutes} minutes</p>
                    </div>
                    
                    <p>If you didn't request this code, please ignore this email.</p>
                    
                    <div class="warning">
                        ⚠️ Never share this code with anyone. UrbanFlow staff will never ask for your verification code.
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated message from UrbanFlow Traffic Simulation System</p>
                    <p>© 2025 UrbanFlow - Calamba City Traffic Management</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text fallback
        text_body = f"""
        UrbanFlow - Publish Verification Code
        
        Hello {recipient_name},
        
        You requested to publish a traffic disruption simulation.
        
        Your Verification Code: {otp_code}
        
        This code is valid for {expires_minutes} minutes.
        
        If you didn't request this code, please ignore this email.
        
        Never share this code with anyone.
        
        ---
        UrbanFlow Traffic Simulation System
        © 2025 UrbanFlow - Calamba City Traffic Management
        """
        
        # Attach both versions
        part1 = MIMEText(text_body, 'plain')
        part2 = MIMEText(html_body, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email with better error handling
        print(f"📧 Attempting to send email to {recipient_email}")
        print(f"   Using SMTP: {EMAIL_HOST}:{EMAIL_PORT}")
        print(f"   From: {EMAIL_USER}")
        
        server = smtplib.SMTP(EMAIL_HOST, EMAIL_PORT)
        server.set_debuglevel(1)  # Enable debug output
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(EMAIL_USER, EMAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        print(f"✓ Email sent successfully to {recipient_email}")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"✗ SMTP Authentication Error: {e}")
        print("   Check: 1) App password is correct 2) 2-Step verification is enabled 3) Less secure app access")
        raise Exception(f"Email authentication failed: {e}")
    except smtplib.SMTPException as e:
        print(f"✗ SMTP Error: {e}")
        raise Exception(f"Email sending failed: {e}")
    except Exception as e:
        print(f"✗ Email sending failed: {e}")
        raise
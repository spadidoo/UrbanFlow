import nodemailer from "nodemailer";

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validate required fields
    const errors = {};
    if (!name || name.trim() === "") {
      errors.name = "Name is required";
    }
    if (!email || email.trim() === "") {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Please enter a valid email address";
    }
    if (!subject || subject.trim() === "") {
      errors.subject = "Subject is required";
    }
    if (!message || message.trim() === "") {
      errors.message = "Message is required";
    }

    if (Object.keys(errors).length > 0) {
      return Response.json({ success: false, errors }, { status: 400 });
    }

    // Create transporter with Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    // Email content
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.CONTACT_RECIPIENT,
      replyTo: email,
      subject: `[UrbanFlow Contact] ${subject}`,
      text: `
New contact form submission from UrbanFlow:

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}
      `,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">New Contact Form Submission</h2>
  <p style="color: #666;">You have received a new message from the UrbanFlow website.</p>
  
  <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 100px;">Name:</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${name}</td>
    </tr>
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Email:</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <a href="mailto:${email}">${email}</a>
      </td>
    </tr>
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Subject:</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${subject}</td>
    </tr>
  </table>
  
  <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px;">
    <p style="font-weight: bold; margin-bottom: 10px;">Message:</p>
    <p style="white-space: pre-wrap; margin: 0;">${message}</p>
  </div>
  
  <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
  <p style="color: #999; font-size: 12px;">
    This email was sent from the UrbanFlow contact form.
  </p>
</div>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to send message. Please try again later.",
      },
      { status: 500 }
    );
  }
}

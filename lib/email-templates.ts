function emailFooter(year: number) {
  return `
    <div style="padding:16px 24px;border-top:1px solid #eee;font-family:Arial,Helvetica,sans-serif">
      <p style="color:#aaa;font-size:11px;margin:0 0 4px">© ${year} Nexora POS - automated message, please don't reply.</p>
      <p style="color:#ccc;font-size:11px;margin:0">Design &amp; Developed by plexCode</p>
    </div>
  `;
}

function emailShell(body: string, year: number) {
  return `
    <div style="background:#f4f4f5;padding:32px 16px;font-family:Georgia,'Times New Roman',serif">
      <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
        <div style="background:#000;padding:20px 24px">
          <span style="font-size:22px;color:#fff;letter-spacing:0.5px;font-style:italic">Nexora</span>
        </div>
        <div style="padding:28px 24px;font-family:Arial,Helvetica,sans-serif;color:#111">
          ${body}
        </div>
        ${emailFooter(year)}
      </div>
    </div>
  `;
}

export function changeEmailTemplate(newEmail: string, link: string, currentEmail?: string) {
  const year = new Date().getFullYear();
  return emailShell(
    `
      <h1 style="font-size:16px;margin:0 0 12px">Confirm your email change</h1>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.5">
        ${currentEmail ? `You asked to change the email on your Nexora POS account from <strong>${currentEmail}</strong> to <strong>${newEmail}</strong>.` : `Confirm <strong>${newEmail}</strong> as your new Nexora POS email.`}
      </p>
      <p style="color:#999;font-size:12px;margin:0 0 20px">This link expires in 1 hour for your security.</p>
      <a href="${link}" style="background:#000;color:#fff;font-size:13px;padding:10px 22px;text-decoration:none;border-radius:6px;display:inline-block">
        Confirm Email
      </a>
      <p style="color:#999;font-size:12px;margin:20px 0 0">
        If you didn't request this, you can ignore this email - your address won't be changed.
      </p>
      <p style="color:#bbb;font-size:11px;margin:16px 0 0;word-break:break-all">
        Button not working? Paste this link into your browser:<br />
        <a href="${link}" style="color:#999">${link}</a>
      </p>
    `,
    year
  );
}

export function passwordResetOtpTemplate(otp: string) {
  const year = new Date().getFullYear();
  return emailShell(
    `
      <h1 style="font-size:16px;margin:0 0 12px">Reset your password</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.5">
        Use the code below to reset your Nexora POS password. It expires in 10 minutes.
      </p>
      <p style="background:#f4f4f5;border-radius:6px;padding:16px;text-align:center;font-size:28px;letter-spacing:8px;font-weight:bold;color:#111;margin:0 0 20px">
        ${otp}
      </p>
      <p style="color:#999;font-size:12px;margin:0">
        If you didn't request this, you can ignore this email - your password won't change.
      </p>
    `,
    year
  );
}

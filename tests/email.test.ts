import assert from "node:assert/strict";
import test from "node:test";
import nodemailer from "nodemailer";
import { emailConfiguration, sendEmail } from "../lib/server/email";

test("Gmail uses the connected sender, preserves replies, and closes its transport", async () => {
  const names = ["EMAIL_PROVIDER", "GMAIL_USER", "GMAIL_APP_PASSWORD"];
  const previous = names.map((name) => process.env[name]);
  const original = nodemailer.createTransport;
  Object.assign(process.env, {
    EMAIL_PROVIDER: "gmail",
    GMAIL_USER: "sender@example.test",
    GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
  });
  assert.equal(emailConfiguration(), null);
  process.env.GMAIL_USER = "sender@gmail.com";
  assert.equal(emailConfiguration()?.from, "Service Quote <sender@gmail.com>");
  let closed = false;
  let rejected = false;
  nodemailer.createTransport = ((options: Record<string, unknown>) => {
    assert.equal(options.host, "smtp.gmail.com");
    assert.equal(options.secure, true);
    assert.equal(options.disableUrlAccess, true);
    assert.deepEqual(options.auth, { user: "sender@gmail.com", pass: "abcdefghijklmnop" });
    return {
      sendMail: async (message: Record<string, unknown>) => {
        assert.equal(message.from, "Service Quote <sender@gmail.com>");
        assert.equal(message.replyTo, "customer@example.test");
        assert.equal(message.to, "owner@example.test");
        assert.match(String(message.messageId), /^<[a-f0-9]{64}@gmail.com>$/);
        return {
          messageId: "accepted",
          accepted: rejected ? [] : [message.to],
          rejected: rejected ? [message.to] : [],
        };
      },
      close: () => {
        closed = true;
      },
    };
  }) as unknown as typeof nodemailer.createTransport;
  const email = {
    from: "ignored@example.test",
    to: "owner@example.test",
    reply_to: "customer@example.test",
    subject: "Request",
    html: "<p>Request</p>",
  };
  try {
    assert.equal(await sendEmail("unused", email, "lead/123", Date.now() + 2000), "accepted");
    assert.equal(closed, true);
    rejected = true;
    await assert.rejects(
      sendEmail("unused", email, "lead/124", Date.now() + 2000),
      /did not accept/,
    );
    await assert.rejects(sendEmail("unused", email, "lead/124", Date.now() - 1), /deadline/);
  } finally {
    nodemailer.createTransport = original;
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});

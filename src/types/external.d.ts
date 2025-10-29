declare module 'pdfkit' {
  export default class PDFDocument {
    constructor(options?: Record<string, unknown>)
    on(event: string, listener: (...args: unknown[]) => void): this
    fontSize(size: number): this
    text(text: string, options?: Record<string, unknown>): this
    moveDown(lines?: number): this
    fillColor(color: string): this
    end(): void
  }
}

declare module 'pdfkit/js/pdfkit.standalone.js' {
  import PDFDocument from 'pdfkit'
  export default PDFDocument
}

declare module 'nodemailer' {
  import type { Buffer } from 'node:buffer'

  type SendMailOptions = {
    from: string
    to: string
    subject: string
    text: string
    attachments?: Array<{
      filename: string
      content: Buffer
    }>
  }

  type TransportOptions = {
    host: string
    port: number
    secure?: boolean
    auth: {
      user: string
      pass: string
    }
  }

  interface Transporter {
    sendMail(options: SendMailOptions): Promise<unknown>
  }

  function createTransport(options: TransportOptions): Transporter

  const nodemailer: {
    createTransport: typeof createTransport
  }

  export { createTransport, Transporter, TransportOptions, SendMailOptions }
  export default nodemailer
}

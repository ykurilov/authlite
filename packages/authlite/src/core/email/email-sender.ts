export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Почтовый провайдер. Чтобы подключить другой сервис, реализуйте этот интерфейс. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

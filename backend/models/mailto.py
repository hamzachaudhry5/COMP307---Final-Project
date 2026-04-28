from sqlmodel import  SQLModel

class MailtoPayload(SQLModel):
    to: str
    subject: str
    body: str


class MailtoResponse(SQLModel):
    mailto: MailtoPayload


def build_mailto(to: str, subject: str, body: str) -> MailtoResponse:
    return MailtoResponse(mailto=MailtoPayload(to=to, subject=subject, body=body))

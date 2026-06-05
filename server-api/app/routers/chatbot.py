from fastapi import APIRouter, HTTPException

from app.models import ChatbotMessageRequest, ChatbotMessageResponse
from app.services import chatbot_service


router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])


@router.post("/message", response_model=ChatbotMessageResponse)
async def send_chatbot_message(request: ChatbotMessageRequest) -> dict:
    if not request.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    try:
        return await chatbot_service.generate_chatbot_message(
            message=request.message,
            page_context=request.page_context,
            conversation_history=request.conversation_history,
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Unable to generate chatbot reply: {error}") from error

from typing import Optional, List

from pydantic import BaseModel

from models.dto.retell import RetellRoleType, WordTimings

class LiveKitUtterance(BaseModel):
    role: RetellRoleType
    content: str
    words: Optional[List[WordTimings]] = None
    call_id: str
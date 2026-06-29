"""联网搜索工具 - 为旅行定制提供实时信息检索能力"""

from langchain.tools import tool
from coze_coding_dev_sdk import SearchClient
from coze_coding_utils.log.write_log import request_context
from coze_coding_utils.runtime_ctx.context import new_context


@tool
def web_search(query: str) -> str:
    """联网搜索工具，可获取最新的旅行相关信息，包括景点介绍、天气情况、交通方式、美食推荐、住宿建议、旅行攻略等实时内容。当需要查询目的地的实时信息时使用此工具。

    Args:
        query: 搜索关键词，例如"京都必去景点推荐"、"泰国4月天气"、"巴黎交通攻略"等
    """
    ctx = request_context.get() or new_context(method="web_search")
    client = SearchClient(ctx=ctx)
    response = client.web_search_with_summary(query=query, count=5)

    results = []
    if response.summary:
        results.append(f"【摘要】{response.summary}")

    if response.web_items:
        for i, item in enumerate(response.web_items, 1):
            title = item.title or "无标题"
            snippet = item.snippet or ""
            url = item.url or ""
            results.append(f"[{i}] {title}\n{snippet}\n来源: {url}")

    if not results:
        return "未找到相关搜索结果，请尝试更换关键词。"

    return "\n\n".join(results)

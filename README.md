# HNG 14 STAGE 2 BACKEND TASK

## Natural Language Parsing Approach

Our search endpoint (`/api/profiles/search`) implements a **strict rule-based parser**. It does not use any AI or LLMs. 

### How it Works:
The parser utilizes a keyword-matching engine that scans the user's query string for particular tokens. It maps these tokens to structured database filters before executing a query.

### Supported Keywords & Mappings:
| Keyword | Mapping / Logic |
| :--- | :--- |
| **"young"** | Filters for ages between **16 and 24** (inclusive). |
| **"male"** | Sets `gender` filter to 'male' (unless 'female' is also present). |
| **"female"** | Sets `gender` filter to 'female'. |
| **"teenager"** | Sets `age_group` filter to 'teenager'. |
| **"adult"** | Sets `age_group` filter to 'adult'. |
| **"senior"** | Sets `age_group` filter to 'senior'. |
| **"above [X]"** | Uses a Regular Expression (`/above (\\d+)/`) to extract the number and set a `min_age` filter. |
| **Country Names** | Maps common country names (e.g., "nigeria", "kenya") to their respective ISO `country_id`. |

### Logic Flow:
1. The query is converted to lowercase.
2. The engine checks for the presence of the keywords listed above.
3. If keywords are found, a filter object is constructed and passed to the MongoDB query engine.
4. If **no keywords** are recognized, the API returns a `400 Bad Request` with the message: `"Unable to interpret query"`.

---

## Limitations and edge cases

While efficient, the rule-based approach has specific limitations:

1.The parser cannot handle complex sentence structures or negations (e.g., "everyone who is not a teenager").
2.If a query contains conflicting keywords (e.g., "young senior"), the parser will apply both filters, likely resulting in zero matches.
3.Only the specific keywords mentioned above are supported. Synonyms like "youth" or "elderly" are currently not mapped.
4.Only a predefined list of country names is supported within the parser; others must be filtered via the standard `/api/profiles` query parameters.

import fitz  # PyMuPDF
from bs4 import BeautifulSoup
import re
import json
from math import ceil
import os
import sys
global page
page = 0
def do_it(soup):
    pattern = r"<span style=\"font-size:\s*(\d*\.?\d+)px;\s*font-family:\s*([-\w,\s]+);?\">(.*?)<\/span>"
    global page
    final = []
    ln = []
    for tag in soup.find_all():
        if tag.name == 'h3':
            if page == 0:
                page += 1
            else:
                final += process_list(ln)
                ln = []
                page += 1
        elif tag.name == "span":
            t = str(tag).replace("\n", "")
            res = re.search(pattern, t)
            ln.append([ceil(float(res.group(1))), res.group(2), res.group(3).strip(), page])
    return final + process_list(ln)

def process_list(ln):
    stopwords = [".", "..","...","?","-","--","1","2","3","4","5","6","7","8","9","0","a", "aadi", "aaj", "aap", "aapne", "aata", "aati", "aaya", "aaye", "ab", "abbe", "abbey", "abe", "abhi", "able", "about", "above", "accha", "according", "accordingly", "acha", "achcha", "across", "actually", "after", "afterwards", "again", "against", "agar", "ain", "aint", "ain't", "aisa", "aise", "aisi", "alag", "all", "allow", "allows", "almost", "alone", "along", "already", "also", "although", "always", "am", "among", "amongst", "an", "and", "andar", "another", "any", "anybody", "anyhow", "anyone", "anything", "anyway", "anyways", "anywhere", "ap", "apan", "apart", "apna", "apnaa", "apne", "apni", "appear", "are", "aren", "arent", "aren't", "around", "arre", "as", "aside", "ask", "asking", "at", "aur", "avum", "aya", "aye", "baad", "baar", "bad", "bahut", "bana", "banae", "banai", "banao", "banaya", "banaye", "banayi", "banda", "bande", "bandi", "bane", "bani", "bas", "bata", "batao", "bc", "be", "became", "because", "become", "becomes", "becoming", "been", "before", "beforehand", "behind", "being", "below", "beside", "besides", "best", "better", "between", "beyond", "bhai", "bheetar", "bhi", "bhitar", "bht", "bilkul", "bohot", "bol", "bola", "bole", "boli", "bolo", "bolta", "bolte", "bolti", "both", "brief", "bro", "btw", "but", "by", "came", "can", "cannot", "cant", "can't", "cause", "causes", "certain", "certainly", "chahiye", "chaiye", "chal", "chalega", "chhaiye", "clearly", "c'mon", "com", "come", "comes", "could", "couldn", "couldnt", "couldn't", "d", "de", "dede", "dega", "degi", "dekh", "dekha", "dekhe", "dekhi", "dekho", "denge", "dhang", "di", "did", "didn", "didnt", "didn't", "dijiye", "diya", "diyaa", "diye", "diyo", "do", "does", "doesn", "doesnt", "doesn't", "doing", "done", "dono", "dont", "don't", "doosra", "doosre", "down", "downwards", "dude", "dunga", "dungi", "during", "dusra", "dusre", "dusri", "dvaara", "dvara", "dwaara", "dwara", "each", "edu", "eg", "eight", "either", "ek", "else", "elsewhere", "enough", "etc", "even", "ever", "every", "everybody", "everyone", "everything", "everywhere", "ex", "exactly", "example", "except", "far", "few", "fifth", "fir", "first", "five", "followed", "following", "follows", "for", "forth", "four", "from", "further", "furthermore", "gaya", "gaye", "gayi", "get", "gets", "getting", "ghar", "given", "gives", "go", "goes", "going", "gone", "good", "got", "gotten", "greetings", "guys", "haan", "had", "hadd", "hadn", "hadnt", "hadn't", "hai", "hain", "hamara", "hamare", "hamari", "hamne", "han", "happens", "har", "hardly", "has", "hasn", "hasnt", "hasn't", "have", "haven", "havent", "haven't", "having", "he", "hello", "help", "hence", "her", "here", "hereafter", "hereby", "herein", "here's", "hereupon", "hers", "herself", "he's", "hi", "him", "himself", "his", "hither", "hm", "hmm", "ho", "hoga", "hoge", "hogi", "hona", "honaa", "hone", "honge", "hongi", "honi", "hopefully", "hota", "hotaa", "hote", "hoti", "how", "howbeit", "however", "hoyenge", "hoyengi", "hu", "hua", "hue", "huh", "hui", "hum", "humein", "humne", "hun", "huye", "huyi", "i", "i'd", "idk", "ie", "if", "i'll", "i'm", "imo", "in", "inasmuch", "inc", "inhe", "inhi", "inho", "inka", "inkaa", "inke", "inki", "inn", "inner", "inse", "insofar", "into", "inward", "is", "ise", "isi", "iska", "iskaa", "iske", "iski", "isme", "isn", "isne", "isnt", "isn't", "iss", "isse", "issi", "isski", "it", "it'd", "it'll", "itna", "itne", "itni", "itno", "its", "it's", "itself", "ityaadi", "ityadi", "i've", "ja", "jaa", "jab", "jabh", "jaha", "jahaan", "jahan", "jaisa", "jaise", "jaisi", "jata", "jayega", "jidhar", "jin", "jinhe", "jinhi", "jinho", "jinhone", "jinka", "jinke", "jinki", "jinn", "jis", "jise", "jiska", "jiske", "jiski", "jisme", "jiss", "jisse", "jitna", "jitne", "jitni", "jo", "just", "jyaada", "jyada", "k", "ka", "kaafi", "kab", "kabhi", "kafi", "kaha", "kahaa", "kahaan", "kahan", "kahi", "kahin", "kahte", "kaisa", "kaise", "kaisi", "kal", "kam", "kar", "kara", "kare", "karega", "karegi", "karen", "karenge", "kari", "karke", "karna", "karne", "karni", "karo", "karta", "karte", "karti", "karu", "karun", "karunga", "karungi", "kaun", "kaunsa", "kayi", "kch", "ke", "keep", "keeps", "keh", "kehte", "kept", "khud", "ki", "kin", "kine", "kinhe", "kinho", "kinka", "kinke", "kinki", "kinko", "kinn", "kino", "kis", "kise", "kisi", "kiska", "kiske", "kiski", "kisko", "kisliye", "kisne", "kitna", "kitne", "kitni", "kitno", "kiya", "kiye", "know", "known", "knows", "ko", "koi", "kon", "konsa", "koyi", "krna", "krne", "kuch", "kuchch", "kuchh", "kul", "kull", "kya", "kyaa", "kyu", "kyuki", "kyun", "kyunki", "lagta", "lagte", "lagti", "last", "lately", "later", "le", "least", "lekar", "lekin", "less", "lest", "let", "let's", "li", "like", "liked", "likely", "little", "liya", "liye", "ll", "lo", "log", "logon", "lol", "look", "looking", "looks", "ltd", "lunga", "m", "maan", "maana", "maane", "maani", "maano", "magar", "mai", "main", "maine", "mainly", "mana", "mane", "mani", "mano", "many", "mat", "may", "maybe", "me", "mean", "meanwhile", "mein", "mera", "mere", "merely", "meri", "might", "mightn", "mightnt", "mightn't", "mil", "mjhe", "more", "moreover", "most", "mostly", "much", "mujhe", "must", "mustn", "mustnt", "mustn't", "my", "myself", "na", "naa", "naah", "nahi", "nahin", "nai", "name", "namely", "nd", "ne", "near", "nearly", "necessary", "neeche", "need", "needn", "neednt", "needn't", "needs", "neither", "never", "nevertheless", "new", "next", "nhi", "nine", "no", "nobody", "non", "none", "noone", "nope", "nor", "normally", "not", "nothing", "novel", "now", "nowhere", "o", "obviously", "of", "off", "often", "oh", "ok", "okay", "old", "on", "once", "one", "ones", "only", "onto", "or", "other", "others", "otherwise", "ought", "our", "ours", "ourselves", "out", "outside", "over", "overall", "own", "par", "pata", "pe", "pehla", "pehle", "pehli", "people", "per", "perhaps", "phla", "phle", "phli", "placed", "please", "plus", "poora", "poori", "provides", "pura", "puri", "q", "que", "quite", "raha", "rahaa", "rahe", "rahi", "rakh", "rakha", "rakhe", "rakhen", "rakhi", "rakho", "rather", "re", "really", "reasonably", "regarding", "regardless", "regards", "rehte", "rha", "rhaa", "rhe", "rhi", "ri", "right", "s", "sa", "saara", "saare", "saath", "sab", "sabhi", "sabse", "sahi", "said", "sakta", "saktaa", "sakte", "sakti", "same", "sang", "sara", "sath", "saw", "say", "saying", "says", "se", "second", "secondly", "see", "seeing", "seem", "seemed", "seeming", "seems", "seen", "self", "selves", "sensible", "sent", "serious", "seriously", "seven", "several", "shall", "shan", "shant", "shan't", "she", "she's", "should", "shouldn", "shouldnt", "shouldn't", "should've", "si", "sir", "sir.", "since", "six", "so", "soch", "some", "somebody", "somehow", "someone", "something", "sometime", "sometimes", "somewhat", "somewhere", "soon", "still", "sub", "such", "sup", "sure", "t", "tab", "tabh", "tak", "take", "taken", "tarah", "teen", "teeno", "teesra", "teesre", "teesri", "tell", "tends", "tera", "tere", "teri", "th", "tha", "than", "thank", "thanks", "thanx", "that", "that'll", "thats", "that's", "the", "theek", "their", "theirs", "them", "themselves", "then", "thence", "there", "thereafter", "thereby", "therefore", "therein", "theres", "there's", "thereupon", "these", "they", "they'd", "they'll", "they're", "they've", "thi", "thik", "thing", "think", "thinking", "third", "this", "tho", "thoda", "thodi", "thorough", "thoroughly", "those", "though", "thought", "three", "through", "throughout", "thru", "thus", "tjhe", "to", "together", "toh", "too", "took", "toward", "towards", "tried", "tries", "true", "truly", "try", "trying", "tu", "tujhe", "tum", "tumhara", "tumhare", "tumhari", "tune", "twice", "two", "um", "umm", "un", "under", "unhe", "unhi", "unho", "unhone", "unka", "unkaa", "unke", "unki", "unko", "unless", "unlikely", "unn", "unse", "until", "unto", "up", "upar", "upon", "us", "use", "used", "useful", "uses", "usi", "using", "uska", "uske", "usne", "uss", "usse", "ussi", "usually", "vaala", "vaale", "vaali", "vahaan", "vahan", "vahi", "vahin", "vaisa", "vaise", "vaisi", "vala", "vale", "vali", "various", "ve", "very", "via", "viz", "vo", "waala", "waale", "waali", "wagaira", "wagairah", "wagerah", "waha", "wahaan", "wahan", "wahi", "wahin", "waisa", "waise", "waisi", "wala", "wale", "wali", "want", "wants", "was", "wasn", "wasnt", "wasn't", "way", "we", "we'd", "well", "we'll", "went", "were", "we're", "weren", "werent", "weren't", "we've", "what", "whatever", "what's", "when", "whence", "whenever", "where", "whereafter", "whereas", "whereby", "wherein", "where's", "whereupon", "wherever", "whether", "which", "while", "who", "whoever", "whole", "whom", "who's", "whose", "why", "will", "willing", "with", "within", "without", "wo", "woh", "wohi", "won", "wont", "won't", "would", "wouldn", "wouldnt", "wouldn't", "y", "ya", "yadi", "yah", "yaha", "yahaan", "yahan", "yahi", "yahin", "ye", "yeah", "yeh", "yehi", "yes", "yet", "you", "you'd", "you'll", "your", "you're", "yours", "yourself", "yourselves", "you've", "yup"]
    date_patterns = [
        # Full formats with day and year (e.g., 1 March 2023, March 1st 2023, etc.)
        r'^\d{1,2}(st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|'
        r'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec),?\s+\d{4}[.,!?]?$',
        
        r'^(January|February|March|April|May|June|July|August|September|October|November|December|'
        r'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2}(st|nd|rd|th)?,?\s+\d{4}[.,!?]?$',

        # Month + year (e.g., March 2023)
        r'^(January|February|March|April|May|June|July|August|September|October|November|December|'
        r'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec),?\s+\d{4}[.,!?]?$',

        # Partial dates like "April 11", "11 Apr"
        r'^\d{1,2}(st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|'
        r'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[.,!?]?$',

        r'^(January|February|March|April|May|June|July|August|September|October|November|December|'
        r'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2}(st|nd|rd|th)?[.,!?]?$',

        # Numeric formats (01/03/2023, 2023-03-01)
        r'^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}[.,!?]?$',
        r'^\d{4}[-/]\d{1,2}[-/]\d{1,2}[.,!?]?$',
    ]
    gibberish_patterns = [
        r'^[\.\-\*_~=#]{3,}$',
        r'^[\.\-\*_~=# ]{0,2}[\.\-\*_~=#]{3,}[\.\-\*_~=# ]{0,2}$'
        r'^[\W_]{4,}$',
    ]
    start_indicators = r'^(?:\d+[\.\)]|[a-zA-Z][\.\)]|[ivxlcdmIVXLCDM]+\)|\d+\.\d+)$'
    # empty removed
    i = 0
    while i < len(ln):
        obj = ln[i]
        if obj[2].strip() == "" or len(obj[2]) < 4 or len(obj[2].split()) > 10:
            ln.pop(i)
        else:
            i+=1
    # remove stopwords
    i = 0
    while i < len(ln):
        obj = ln[i]
        if obj[2] in stopwords:
            ln.pop(i)
        else:
            i += 1
    # remove only numbers
    i = 0
    while i < len(ln):
        obj = ln[i]
        try:
            int(obj[2])
            ln.pop(i)
        except:
            i += 1
    # remove dates
    i = 0
    while i < len(ln):
        obj = ln[i]
        flag = True
        for each in date_patterns:
            if re.match(each, obj[2]):
                flag = False
                break 
        if not flag:
            ln.pop(i)
        else:
            i += 1
    # remove gibberish
    i = 0
    while i < len(ln):
        obj = ln[i]
        flag = True
        for each in gibberish_patterns:
            if re.search(each, obj[2]):
                flag = False
                break
        if not flag:
            ln.pop(i)
        else:
            i += 1
    # remove start indicators
    i = 0
    while i < len(ln):
        obj = ln[i]
        if re.match(start_indicators, obj[2]):
            ln.pop(i)
        else:
            i += 1
    # non bold removed
    i = 0
    while i < len(ln):
        obj = ln[i]
        if "bold" not in obj[1].lower():
            ln.pop(i)
        else:
            i+=1
    # remove things like figure, table or something
    i = 0
    while i < len(ln):
        obj = ln[i]
        if re.search(r"\b(fig\.?|example\.?|figure\.?|table\.?|image\.?|graph\.?|chart\.?)\s*\d+(\.\d+)*", obj[2].lower()):
            ln.pop(i)
        else:
            i += 1
    i = 0
    while i < len(ln):
        j = i+1
        while j < len(ln):
            if ln[j][0] == ln[i][0]:
                if ln[j][2][-1] == ":" or ln[j][2][-1] == "-":
                    ln[j][0] -= 1
                j += 1
            else:
                break
        i=j
    return ln

def pdf_to_html(pdf_path, html_out):
    doc = fitz.open(pdf_path)
    html_content = []
    html_content.append("<html><body>")
    for page_num, page in enumerate(doc, start=1):
        html_content.append(f"<div style='margin:20px; border:1px solid #ccc;'>")
        html_content.append(f"<h3>Page {page_num}</h3>")
        blocks = page.get_text("dict")["blocks"]
        for b in blocks:
            for l in b.get("lines", []):
                for s in l.get("spans", []):
                    text = s["text"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                    size = round(s["size"], 1)
                    font = s.get("font", "Arial")
                    html_content.append(
                        f"<span style='font-size:{size}px; font-family:{font};'>{text} </span>"
                    )
            html_content.append("<br>")
        html_content.append("</div>")
    html_content.append("</body></html>")
    with open(html_out, "w", encoding="utf-8") as f:
        f.write("\n".join(html_content))

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    pdf_file = str(sys.argv[1])
    html_file = "output.html"
    pdf_to_html(pdf_file, html_file)
    with open("./output.html", 'r', encoding="utf-8") as f:
        html = f.read()
    soup = BeautifulSoup(html, 'html.parser')
    final = do_it(soup)
    sizes = set()
    for i in final:
        sizes.add(i[0])
    sizes = sorted(sizes, reverse=True)[:3]
    output = {
        "title": "",
        "outline": []
    }
    for i in final:
        if i[0] == sizes[0]:
            output["outline"].append({"level": "H1", "text": i[2], "page": i[3]})
        elif i[0] == sizes[1]:
            output["outline"].append({"level": "H2", "text": i[2], "page": i[3]})
        elif i[0] == sizes[2]:
            output["outline"].append({"level": "H3", "text": i[2], "page": i[3]})
    print(json.dumps(output, indent=4))
import json
import os
import re
import nltk
import fitz
import re
import argparse
from nltk.tokenize import sent_tokenize
from nltk.corpus import stopwords
from collections import Counter
import sys
from bs4 import BeautifulSoup
nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)
nltk.download("stopwords", quiet=True)

try:
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('punkt')
    nltk.download('stopwords')

BOLD_FLAG = 1 << 4
ITALIC_FLAG = 1 << 1

def is_bold(flags): return bool(flags & BOLD_FLAG)
def is_italic(flags): return bool(flags & ITALIC_FLAG)

def detect_body_font_size(doc):
    sizes = []
    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    sizes.append(round(span["size"]))
    most_common_size = Counter(sizes).most_common(1)
    return most_common_size[0][0] if most_common_size else 12

def determine_heading_level(size_ratio, bold, italic, different_font):
    if size_ratio > 1.5 or (size_ratio > 1.3 and bold):
        return "H1"
    elif size_ratio > 1.2 or (size_ratio > 1.1 and bold) or (different_font and bold):
        return "H2"
    elif size_ratio > 1.05 or (bold or italic):
        return "H3"
    else:
        return "P"

def extract_html_with_structure(pdf_path, out_html="structured_output.html"):
    doc = fitz.open(pdf_path)
    body_font_size = detect_body_font_size(doc)
    font_counter = Counter()
    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    if round(span["size"]) == body_font_size:
                        font_counter[span["font"]] += 1
    body_font_name = font_counter.most_common(1)[0][0] if font_counter else ""
    html = ['<html><body style="font-family:Arial,sans-serif;">']
    current_levels = {"H1": 0, "H2": 0, "H3": 0}
    for page_num, page in enumerate(doc, start=1):
        html.append(f"<div style='margin-top:2em;'><!-- Page {page_num} --></div>")
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            all_text = []
            block_spans = []
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue
                    all_text.append(text)
                    block_spans.append(span)
            block_text = " ".join(all_text)
            word_count = len(block_text.split())
            is_heading_candidate = (
                len(block["lines"]) <= 1 and word_count <= 15
            )
            if is_heading_candidate and block_spans:
                span = block_spans[0]
                size_ratio = span["size"] / body_font_size
                bold = is_bold(span["flags"])
                italic = is_italic(span["flags"])
                different_font = (span["font"] != body_font_name)
                level = determine_heading_level(size_ratio, bold, italic, different_font)
                if level == "H1":
                    current_levels["H1"] += 1
                    current_levels["H2"] = 0
                    current_levels["H3"] = 0
                elif level == "H2":
                    if current_levels["H1"] == 0:
                        level = "H1"
                        current_levels["H1"] += 1
                        current_levels["H2"] = 0
                        current_levels["H3"] = 0
                    else:
                        current_levels["H2"] += 1
                        current_levels["H3"] = 0
                elif level == "H3":
                    if current_levels["H1"] == 0:
                        level = "H1"
                        current_levels["H1"] += 1
                        current_levels["H2"] = 0
                        current_levels["H3"] = 0
                    elif current_levels["H2"] == 0:
                        level = "H2"
                        current_levels["H2"] += 1
                        current_levels["H3"] = 0
                    else:
                        current_levels["H3"] += 1
                style = f"font-size:{span['size']:.1f}pt;"
                text = block_text
                if bold:
                    text = f"<b>{text}</b>"
                if italic:
                    text = f"<i>{text}</i>"
                html.append(f"<{level.lower()} style='{style}'>{text}</{level.lower()}>")
            else:
                paragraph_html = []
                first_span = block_spans[0] if block_spans else {"size": body_font_size}
                style = f"font-size:{first_span['size']:.1f}pt;"
                for span in block_spans:
                    text = span["text"].strip()
                    if not text:
                        continue
                    if is_bold(span["flags"]):
                        text = f"<b>{text}</b>"
                    if is_italic(span["flags"]):
                        text = f"<i>{text}</i>"
                    paragraph_html.append(text)
                full_para = " ".join(paragraph_html)
                html.append(f"<p style='{style}'>{full_para}</p>")
    html.append("</body></html>")
    with open(out_html, "w", encoding="utf-8") as f:
        f.write("\n".join(html))
    doc.close()

def _decode_unicode_escapes_iter(s: str, rounds: int = 3) -> str:
    for _ in range(rounds):
        before = s
        s = re.sub(r'\\U([0-9A-Fa-f]{8})', lambda m: chr(int(m.group(1), 16)), s)
        s = re.sub(r'\\u([0-9A-Fa-f]{4})',  lambda m: chr(int(m.group(1), 16)), s)
        s = re.sub(r'\\x([0-9A-Fa-f]{2})',  lambda m: chr(int(m.group(1), 16)), s)
        if s == before:
            break
    return s

def convert_html_to_sections(html):
    soup = BeautifulSoup(html, 'html.parser')
    page = 0
    heading = ""
    ln = dict()
    for tag in soup.find_all(True):
        if tag.name == "div":
            page += 1
        elif tag.name == "p":
            if bool(tag.text.strip()):
                obj = {"title": heading, "content": tag.text}
                try:
                    ln[page].append(obj)
                except:
                    ln[page] = [obj]
        elif tag.name == "h1" or tag.name == "h2" or tag.name == "h3":
            heading = tag.text
    res = []
    for i in ln:
        objs = ln[i]
        for j in objs:
            if not j["title"]:
                continue
            j["page_number"] = i
            j["content"] = _decode_unicode_escapes_iter(j["content"])
            res.append(j)
    return res

class DocumentAnalyst:
    def __init__(self):
        self.stopwords = set(stopwords.words('english'))
        self.stopwords.update(['may', 'also', 'many', 'would', 'could', 'one', 'two', 'three', 'four'])

    def extract_sections_from_pdf(self, pdf_path):
        pdf_file = pdf_path
        html_file = pdf_file.replace(".pdf", "")+".html"
        if not os.path.exists(html_file):
            extract_html_with_structure(pdf_file, html_file)
        with open(html_file, "r", encoding="utf-8", errors="replace") as f:
            html = f.read()
        return convert_html_to_sections(html)

    def extract_keywords(self, text):
        stop_words = ['may', 'also', 'many', 'would', 'could', 'one', 'two', 'three', 'four']
        words = re.findall(r'\b\w+\b', text.lower())
        for i in stop_words:
            while i in words:
                words.remove(i)
        words = [word for word in words if word not in self.stopwords and len(word) > 2]
        word_counts = Counter(words)
        return word_counts.most_common(20)
    
    def calculate_relevance(self, section, persona, job):
        title = section["title"]
        content = section["content"]
        query = f"{persona} {job}".lower()
        stemmer = nltk.stem.PorterStemmer()
        query_words = set(stemmer.stem(word) for word in re.findall(r'\w+', query) if word not in self.stopwords and len(word) > 2)
        content_words = [stemmer.stem(word) for word in re.findall(r'\w+', content.lower()) if word not in self.stopwords and len(word) > 2]
        title_words = [stemmer.stem(word) for word in re.findall(r'\w+', title.lower()) if word not in self.stopwords and len(word) > 2]
        content_word_counts = Counter(content_words)
        title_word_counts = Counter(title_words)
        content_overlap = sum(min(count, 1) for word, count in content_word_counts.items() if word in query_words) * 4.5
        title_overlap = sum(min(count, 1) for word, count in title_word_counts.items() if word in query_words) * 0.1
        paragraphs = [p for p in content.split('\n') if p.strip()]
        first_last_score = 0
        if paragraphs:
            first_para = paragraphs[0]
            last_para = paragraphs[-1]
            first_words = set(stemmer.stem(word) for word in re.findall(r'\w+', first_para.lower()))
            last_words = set(stemmer.stem(word) for word in re.findall(r'\w+', last_para.lower()))
            first_last_score = (len(first_words & query_words) + len(last_words & query_words)) * 2.0
        indicators = {
            'definition': 5.8,
            'example': 0.3,
            'important': 3.2,
            'key': 0.2,
            'summary': 4.5,
            'conclusion': 0.5
        }
        indicator_score = 0
        for ind, weight in indicators.items():
            if ind in content.lower():
                indicator_score += weight
        content_length = min(len(content_words), 1000) / 1000.0
        relevance_score = (
            content_overlap +
            title_overlap +
            first_last_score +
            indicator_score +
            (content_length * 0.5)
        )
        normalized_score = min(relevance_score / 20.0, 1.0)    #20.0
        return normalized_score
    
    def extract_subsections(self, section_text):
        sentences = sent_tokenize(section_text)
        if len(sentences) <= 5: return section_text
        scored_sentences = []
        for i, sentence in enumerate(sentences):
            keywords = dict(self.extract_keywords(sentence))
            keyword_count = sum(keywords.values())
            position_score = 0
            if i < 3: position_score = 1.0 - (i * 0.2)
            elif i >= len(sentences) - 3: position_score = 0.6 + ((i - (len(sentences) - 3)) * 0.2)
            words = len(sentence.split())
            length_score = min(words / 20.0, 1.0) if words < 50 else 2.0 - (words / 50.0)
            length_score = max(0.0, min(length_score, 1.0))
            info_indicators = ['important', 'key', 'significant', 'essential', 'must', 'should', 'recommend', 'popular', 'best', 'top', 'famous']
            indicator_score = 0.5 if any(indicator in sentence.lower() for indicator in info_indicators) else 0
            final_score = (keyword_count * 0.4) + (position_score * 0.3) + (length_score * 0.2) + (indicator_score * 0.1)
            scored_sentences.append((sentence, final_score))
        sorted_sentences = sorted(scored_sentences, key=lambda x: x[1], reverse=True)
        top_sentences = [s[0] for s in sorted_sentences[:5]]
        ordered_top_sentences = [s for s in sentences if s in top_sentences]
        return " ".join(ordered_top_sentences)

    def analyze_documents(self, input_data):
        documents = input_data.get("documents", [])
        persona = input_data.get("persona", "")
        job = input_data.get("job_to_be_done", "")
        all_sections = []
        for doc in documents:
            pdf_path = doc.get("document_path", "")
            if not os.path.exists(pdf_path):
                continue
            sections = self.extract_sections_from_pdf(pdf_path)
            for section in sections:
                section["file_name"] = doc.get("file_name", "")
                section["relevance"] = self.calculate_relevance(section, persona, job)
                all_sections.append(section)
        temp = []
        i = 0
        while i < len(all_sections):
            j = i+1
            t = [all_sections[i]]
            while j < len(all_sections):
                if all_sections[i]["title"] == all_sections[j]["title"]:
                    t.append(all_sections[j])
                    j+=1
                else:
                    break
            t.sort(key=lambda x: x["relevance"], reverse=True)
            temp.append(t[0])
            i = j
        all_sections = temp
        all_sections.sort(key=lambda x: x["relevance"], reverse=True)
        top_sections = all_sections[:10]
        output_sections = []
        for section in top_sections:
            refined_text = self.extract_subsections(section["content"])
            output_sections.append({
                "section_title": section["title"],
                "page_number": section["page_number"],
                "refined_text": refined_text,
                "file_name": section["file_name"]
            })
        return {"sections": output_sections}

def main2():
    parser = argparse.ArgumentParser(description="Analyze documents based on persona and job-to-be-done")
    parser.add_argument("input_file", help="Path to input JSON file")
    args = parser.parse_args()

    try:
        with open(args.input_file, 'r') as f:
            input_data = json.load(f)
        analyzer = DocumentAnalyst()
        output = analyzer.analyze_documents(input_data)

        # print(json.dumps(output, indent=4, ensure_ascii=False))
        print(json.dumps(output, indent=4))

    except Exception as e:
        sys.exit(1)

if __name__ == "__main__":
    main2()
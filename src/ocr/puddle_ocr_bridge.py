import argparse
import json
import os
import sys


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-dir", required=True)
    parser.add_argument("image_path")
    args = parser.parse_args()

    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

    from paddleocr import PaddleOCR

    models_dir = os.path.join(args.project_dir, "models")
    det_dir = os.path.join(models_dir, "PP-OCRv5_server_det")
    rec_dir = os.path.join(models_dir, "PP-OCRv5_server_rec")

    ocr = PaddleOCR(
        text_detection_model_dir=det_dir,
        text_recognition_model_dir=rec_dir,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    result = ocr.predict(args.image_path)
    item = result[0] if result and result[0] else {}
    texts = item.get("rec_texts") or []
    print(json.dumps({"text": " ".join(str(text) for text in texts if text)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

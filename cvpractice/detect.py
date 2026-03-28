# import depenedencies
# coco classes
# function
    # import model and transform as tensor
    # transform image
    # inference prediction
    # drawing ! 
    # for each object, draw a box and add label + confidence score
    # image show

import torch
from PIL import Image, ImageDraw
from torchvision import models, transforms

# torchvision Faster R-CNN COCO: label indices 0..90 (0 = background, gaps use "N/A")
COCO_CLASSES = [
    "__background__",
    "person",
    "bicycle",
    "car",
    "motorcycle",
    "airplane",
    "bus",
    "train",
    "truck",
    "boat",
    "traffic light",
    "fire hydrant",
    "N/A",
    "stop sign",
    "parking meter",
    "bench",
    "bird",
    "cat",
    "dog",
    "horse",
    "sheep",
    "cow",
    "elephant",
    "bear",
    "zebra",
    "giraffe",
    "N/A",
    "backpack",
    "umbrella",
    "N/A",
    "N/A",
    "handbag",
    "tie",
    "suitcase",
    "frisbee",
    "skis",
    "snowboard",
    "sports ball",
    "kite",
    "baseball bat",
    "baseball glove",
    "skateboard",
    "surfboard",
    "tennis racket",
    "bottle",
    "N/A",
    "wine glass",
    "cup",
    "fork",
    "knife",
    "spoon",
    "bowl",
    "banana",
    "apple",
    "sandwich",
    "orange",
    "broccoli",
    "carrot",
    "hot dog",
    "pizza",
    "donut",
    "cake",
    "chair",
    "couch",
    "potted plant",
    "bed",
    "N/A",
    "dining table",
    "N/A",
    "N/A",
    "toilet",
    "N/A",
    "tv",
    "laptop",
    "mouse",
    "remote",
    "keyboard",
    "cell phone",
    "microwave",
    "oven",
    "toaster",
    "sink",
    "refrigerator",
    "N/A",
    "book",
    "clock",
    "vase",
    "scissors",
    "teddy bear",
    "hair drier",
    "toothbrush",
]


def _label_to_name(label_id: int) -> str:
    if 0 <= label_id < len(COCO_CLASSES):
        return COCO_CLASSES[label_id]
    return f"class_{label_id}"


def detect_obj(image_path):
    model = models.detection.fasterrcnn_resnet50_fpn(pretrained=True)
    model.eval()
    transform = transforms.ToTensor()
    img = Image.open(image_path)
    img_t = transform(img)

    with torch.no_grad():
        pred = model([img_t])

    boxes = pred[0]["boxes"]
    labels = pred[0]["labels"]
    scores = pred[0]["scores"]

    threshold = 0.7

    draw = ImageDraw.Draw(img)
    for box, label, score in zip(boxes, labels, scores):
        if score > threshold:
            x1, y1, x2, y2 = box.tolist()
            name = _label_to_name(int(label.item()))
            draw.rectangle([x1, y1, x2, y2], outline="red", width=3)
            draw.text((x1, y1), f"{name} {score:.2f}", fill="red")

    img.show()
    return pred

if __name__ == "__main__":
    detect_obj("test.jpg")
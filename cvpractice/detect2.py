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

from detect import _label_to_name

def detect_obj(image_path):
    model = models.detection.fasterrcnn_resnet50_fpn(pretrained= True)
        # detection = subclass of object detection models
    model.eval() # inference

    transform = transforms.ToTensor()
        # image preprocessing, cropping
    img = Image.open(image_path)
    img_t = transform(img)

    with torch.no_grad(): # no gradient tracking, less memory
        pred = model([img_t]) # [img_t] is a list of images

    draw = ImageDraw.Draw(img)

    boxes = pred[0]['boxes']
    scores = pred[0]['scores']    
    labels = pred[0]['labels']

    threshold = 0.7

    for box, score, label in zip(boxes, scores, labels):
        if score > threshold:
            x1, y1, x2, y2 = box.tolist()
            name = _label_to_name(int(label.item()))

            draw.rectangle([x1, y1, x2, y2], outline = "red", width = 3)
            draw.text((x1, y1), f"{name} {score: .2f}", fill = "red")   
    
    img.show()
    
    return pred 

if __name__ == "__main__":
    detect_obj("test.jpg")

import face_recognition
import cv2

image = face_recognition.load_image_file("photo.jpg")
face_locations = face_recognition.face_locations(image)

print(f"Found {len(face_locations)} face(s)")

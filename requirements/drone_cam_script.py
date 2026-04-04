import cv2
import asyncio
import websockets

async def send_video():
    async with websockets.connect('ws://smartiotcloud.io:38817/ws') as websocket:
        video = cv2.VideoCapture(0)
        # Initialize the background subtractor
        back_sub = cv2.createBackgroundSubtractorMOG2(history=500, varThreshold=25, detectShadows=True)

        while True:
            success, frame = video.read()
            if not success:
                break
            fg_mask = back_sub.apply(frame)

  # Find contours from the foreground mask
            contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

  # Iterate over contours
            for contour in contours:
    # Only consider contours with a significant area
                if cv2.contourArea(contour) > 1000:
      # Get the bounding box coordinates of the contour
                  x, y, w, h = cv2.boundingRect(contour)

      # Calculate aspect ratio
                  aspect_ratio = float(w) / h

      # Calculate center of mass (COM)
                  moments = cv2.moments(contour)
                  if moments['m00'] > 0:
                    cx = int(moments['m10'] / moments['m00'])
                    cy = int(moments['m01'] / moments['m00'])
                  else:
                    cx, cy = 0, 0

                  # Simple posture classification based on features
                  posture = ""
                  if aspect_ratio > 2:
                    posture = "standing"
                  elif aspect_ratio < 1:
                    posture = "sitting"
                  else:
                    # Consider COM position (adjust threshold)
                    if cy > frame.shape[0] / 2:
                      posture = "standing (maybe)"  # Adjust confidence based on your needs
                    else:
                      posture = "sitting (maybe)"

      # Draw rectangle and posture label
                  cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
                  cv2.putText(frame, posture, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

            _, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            print(f'Sending frame of size: {len(frame_bytes)} bytes')  # Log frame size
            await websocket.send(frame_bytes)

            await asyncio.sleep(0.03)

        video.release()

if __name__ == '__main__':
    asyncio.run(send_video())
import cv2
import asyncio
import websockets

BACKEND_WS_URL = "ws://localhost:5555/stream?role=producer&droneId=drone-01"

async def send_video():
    while True:
        try:
            async with websockets.connect(
                BACKEND_WS_URL,
                max_size=None,
                ping_interval=20,
                ping_timeout=20
            ) as websocket:
                print(f"Connected to backend: {BACKEND_WS_URL}")

                video = cv2.VideoCapture(0)

                # Optional camera settings
                video.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                video.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

                back_sub = cv2.createBackgroundSubtractorMOG2(
                    history=500,
                    varThreshold=25,
                    detectShadows=True
                )

                while True:
                    success, frame = video.read()
                    if not success:
                        print("Failed to read frame")
                        break

                    fg_mask = back_sub.apply(frame)
                    contours, _ = cv2.findContours(
                        fg_mask,
                        cv2.RETR_EXTERNAL,
                        cv2.CHAIN_APPROX_SIMPLE
                    )

                    for contour in contours:
                        if cv2.contourArea(contour) > 1000:
                            x, y, w, h = cv2.boundingRect(contour)
                            aspect_ratio = float(w) / h if h != 0 else 0

                            moments = cv2.moments(contour)
                            if moments["m00"] > 0:
                                cx = int(moments["m10"] / moments["m00"])
                                cy = int(moments["m01"] / moments["m00"])
                            else:
                                cx, cy = 0, 0

                            posture = ""
                            if aspect_ratio > 2:
                                posture = "standing"
                            elif aspect_ratio < 1:
                                posture = "sitting"
                            else:
                                if cy > frame.shape[0] / 2:
                                    posture = "standing (maybe)"
                                else:
                                    posture = "sitting (maybe)"

                            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
                            cv2.putText(
                                frame,
                                posture,
                                (x, y - 10),
                                cv2.FONT_HERSHEY_SIMPLEX,
                                0.7,
                                (0, 0, 255),
                                2
                            )

                    # Compress JPEG before sending
                    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 65]
                    ok, buffer = cv2.imencode(".jpg", frame, encode_param)
                    if not ok:
                        continue

                    frame_bytes = buffer.tobytes()
                    await websocket.send(frame_bytes)

                    # ~15-20 FPS
                    await asyncio.sleep(0.05)

                video.release()

        except Exception as e:
            print("WebSocket connection error:", e)
            print("Retrying in 3 seconds...")
            await asyncio.sleep(3)

if __name__ == "__main__":
    asyncio.run(send_video())
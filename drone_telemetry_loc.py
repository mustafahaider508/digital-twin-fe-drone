# import paho.mqtt.client as mqtt
# import paho.mqtt.publish as publish
# import time
# import json
# import math

# mqtt_broker = "smartiotcloud.io"    
# mqtt_port = 40317
# mqtt_topic = "/ws/drone-state"

# client = mqtt.Client()

# def on_connect(client, userdata, flags, rc):
#     print("Connected with result code " + str(rc))

# def on_publish(client, userdata, mid):
#     print("Message published")

# client.on_connect = on_connect
# client.on_publish = on_publish
# client.connect(mqtt_broker, mqtt_port, 60)

# coordinates = [
#   { "name": "1", "lat": 24.583282, "lon": 46.70191 },
#   { "name": "2", "lat": 24.596393, "lon": 46.702597 },
#   { "name": "3", "lat": 24.612001, "lon": 46.703284 },
#   { "name": "4", "lat": 24.625734, "lon": 46.704658 },
#   { "name": "5", "lat": 24.642586, "lon": 46.707407 },
#   { "name": "6", "lat": 24.651323, "lon": 46.70672 },
#   { "name": "7", "lat": 24.667579, "lon": 46.7048 },
#   { "name": "8", "lat": 24.683147, "lon": 46.705395 },
#   { "name": "9", "lat": 24.69812, "lon": 46.707456 },
#   { "name": "10", "lat": 24.708724, "lon": 46.710891 },
#   { "name": "11", "lat": 24.719952, "lon": 46.709537 },
#   { "name": "12", "lat": 24.738662, "lon": 46.712285 },
#   { "name": "13", "lat": 24.763012, "lon": 46.712392 },
#   { "name": "14", "lat": 24.793249, "lon": 46.722685 },
#   { "name": "15", "lat": 24.803534, "lon": 46.724755 },
#   { "name": "16", "lat": 24.818352, "lon": 46.731193 },
#   { "name": "17", "lat": 24.829569, "lon": 46.734631 },
#   { "name": "18", "lat": 24.83658, "lon": 46.736521 },
# ]

# def compute_bearing(lat1, lon1, lat2, lon2):
#     lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
#     dlon = lon2 - lon1
#     x = math.sin(dlon) * math.cos(lat2)
#     y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
#     return math.degrees(math.atan2(x, y)) % 360

# def send_to_mqtt(topic, payload):
#     mqtt_host = "smartiotcloud.io" 
#     mqtt_port = 38131
#     publish.single(topic, payload, hostname=mqtt_host, port=mqtt_port)

# previous_coord = None
# a = 1

# while True:
#     a = a + 1
#     if a > 18:
#         a = 1

#     current = coordinates[a - 1]

#     yaw_deg = 0
#     if previous_coord:
#         yaw_deg = compute_bearing(
#             previous_coord["lat"], previous_coord["lon"],
#             current["lat"], current["lon"]
#         )

#     telemetry = {
#         "droneId": "drone_1",
#         "lat": current["lat"],
#         "lon": current["lon"],
#         "alt": 120,
#         "yaw": round(yaw_deg, 2),
#         "pitch": 0,
#         "roll": 0,
#         "battery": 80,
#         "speed": 70,
#         "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
#     }

#     client.publish(mqtt_topic, json.dumps(telemetry))
#     print(f"Published: lat={telemetry['lat']}, lon={telemetry['lon']}, yaw={telemetry['yaw']}")

#     # Also send to the separate dash topics (for any other consumers)
#     send_to_mqtt(f"dash/drone_1/droneid", "Drone1")
#     send_to_mqtt(f"dash/drone_1/battery", str(telemetry["battery"]))
#     send_to_mqtt(f"dash/drone_1/speed", str(telemetry["speed"]))
#     send_to_mqtt(f"dash/drone_1/altitude", str(telemetry["alt"]))
#     send_to_mqtt(f"dash/drone_1/yaw", str(telemetry["yaw"]))
#     send_to_mqtt(f"dash/drone_1/pitch", str(telemetry["pitch"]))
#     send_to_mqtt(f"dash/drone_1/roll", str(telemetry["roll"]))

#     previous_coord = current
#     time.sleep(0.5)


"""
Drone telemetry — segmented MQTT publish (semantic split).

Flow:
  1) Each metric uses its own topic: dash/<deviceId>/<field> on DRONE_SEG_BROKER (port 38131).
     The simulator merges segments into one canonical WebSocket `drone_state` (schema v1.0).
  2) Position JSON goes to dash/drone/position on the long-lived client broker (port 40317)
     and optionally to Node-RED on POSITION_BROKER (port 40387) for merge/debug flows.
  3) Optional override: publish one JSON object to dash/<deviceId>/state with full lat/lon
     and fields — the server applies it as a single canonical snapshot (see simulator
     lib/droneStateSegmentation.js).

Env on server: DRONE_PRIMARY_ID=drone_1 (which device drives the main UI when several exist).
"""

import paho.mqtt.client as mqtt
import paho.mqtt.publish as publish
import time
import json
 
mqtt_broker = "smartiotcloud.io"    
mqtt_port = 40317
mqtt_topic = "/dash/drone/position"
# MQTT client
client = mqtt.Client()

 
def on_connect(client, userdata, flags, rc):
    print("Connected with result code "+str(rc))

def on_publish(client, userdata, mid):
    print("Message published")

client.on_connect = on_connect
client.on_publish = on_publish
client.connect(mqtt_broker, mqtt_port, 60)

coordinates = [
{"name":"1","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"2","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"3","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"4","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"5","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"6","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"7","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"8","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"9","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"10","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"11","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"12","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"13","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"14","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"15","lat":51.497504435969475,"lon":  -0.10071722464208459},
{"name":"16","lat":51.497504435969475,"lon":  -0.10071722464208459},


]

def droneid(drone_id, id):
    topic = f"dash/{drone_id}/droneid"
    payload = f"{id}"
    send_to_mqtt(topic, payload)
  
def dist_gcs(drone_id, dist):
    topic = f"dash/{drone_id}/dist_gcs"
    payload = f"{dist}"
    send_to_mqtt(topic, payload)


def flight_time_left(drone_id,time_left ):
    topic = f"dash/{drone_id}/flight_time_left"
    payload = f"{time_left}"
    send_to_mqtt(topic, payload)


def battery(car_id, bat_lvl):
    topic = f"dash/{car_id}/battery"
    payload = f"{bat_lvl}"
    send_to_mqtt(topic, payload)

def speed(drone_id, spd):
    topic = f"dash/{drone_id}/speed"
    payload = f"{spd}"
    send_to_mqtt(topic, payload)

def altitude(drone_id, alt):
    topic = f"dash/{drone_id}/altitude"
    payload = f"{alt}"
    send_to_mqtt(topic, payload)

def pitch(drone_id, pitch_lvl):
    topic = f"dash/{drone_id}/pitch"
    payload = f"{pitch_lvl}"
    send_to_mqtt(topic, payload)

def yaw(drone_id,yaw_lvl):
    topic = f"dash/{drone_id}/yaw"
    payload = f"{yaw_lvl}"
    send_to_mqtt(topic, payload)

def roll(drone_id,roll_lvl):
    topic = f"dash/{drone_id}/roll"
    payload = f"{roll_lvl}"
    send_to_mqtt(topic, payload)
color_mapping = {
    "drone_1": "blue",

    }
icon_mapping = {
    "drone_1": "uav",
   
}

previous_position = None

def location(loc,car_id, coord):
    global previous_position
    for c in coord:
        if c["name"] == loc:
            name = c["name"]
            lat = c["lat"]
            lon = c["lon"]
            icon = icon_mapping[car_id] if car_id in icon_mapping else "default.png"
            color = color_mapping[car_id] if car_id in color_mapping else "green"  # Default icon if not mapped
            position = {"name": name, "lat": lat, "lon": lon, "icon": icon, "iconColor": color}

            # Node-RED subscribes to dash/drone/position (port 40387) — send every position so debug/WS get updates
            position_for_nodered = {"droneId": car_id, "name": name, "lat": lat, "lon": lon, "icon": icon, "iconColor": color}
            send_position_to_nodered(position_for_nodered)

            if previous_position:
            # Prepare message to delete previous position
                delete_message = {
                    "_type": "update",
                    "name": previous_position["name"],
                    "deleted": True
            }
            # Publish message to delete previous position
                client.publish(mqtt_topic, json.dumps(delete_message))

            print(name, lat, lon,position, icon,color)
        # Publish new position
            client.publish(mqtt_topic, json.dumps(position))
            previous_position = position
            
 
def send_to_mqtt(topic, payload):
    mqtt_host = "smartiotcloud.io" 
    mqtt_port = 38131
    publish.single(topic, payload, hostname=mqtt_host, port=mqtt_port)


# Node-RED position flow subscribes to dash/drone/position on port 40387
POSITION_BROKER = "smartiotcloud.io"
POSITION_PORT = 40387
POSITION_TOPIC = "dash/drone/position"


def send_position_to_nodered(payload_dict):
    """Publish position to Node-RED so merge node and WS get every update."""
    publish.single(
        POSITION_TOPIC,
        json.dumps(payload_dict),
        hostname=POSITION_BROKER,
        port=POSITION_PORT,
    )
a=1

while True:
    a = a + 1
    if a > 18:
        a = 1
    
    location(str(a), "drone_1", coordinates)
   
    droneid("drone_1", "Drone1")
    dist_gcs("drone_1", "280m")
    flight_time_left("drone_1", "55mins")
    battery("drone_1", 80)
    speed("drone_1", 70)
    altitude("drone_1",120)
    yaw("drone_1","20 Degrees")
    pitch("drone_1","45 Degrees")
    roll("drone_1","5 Degrees")
    # time.sleep(0.5) 



# client.on_connect = on_connect
# client.on_publish = on_publish
# client.connect(mqtt_broker, mqtt_port, 60)
# client.disconnect()

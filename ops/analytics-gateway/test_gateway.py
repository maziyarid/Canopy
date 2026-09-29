import json, os, socket, sqlite3, subprocess, sys, tempfile, threading, time, unittest, urllib.error, urllib.request
from datetime import date, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from portfolio_gsc import project_site_map
from monitor_dispatch import bridge_event
GATEWAY=ROOT/'gateway.py'

def free_port():
    s=socket.socket(); s.bind(('127.0.0.1',0)); p=s.getsockname()[1]; s.close(); return p

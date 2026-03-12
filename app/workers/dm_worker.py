import logging
import time

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

from app.services.dm_service import poll_all_accounts

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def run_poll_cycle() -> None:
    try:
        count = poll_all_accounts()
        logger.info("DM poll cycle complete. New messages: %s", count)
    except Exception as exc:
        logger.error("DM poll cycle failed: %s", str(exc))


def main() -> None:
    scheduler = BackgroundScheduler()
    scheduler.add_job(run_poll_cycle, "interval", minutes=2, max_instances=1)
    scheduler.start()

    try:
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()


if __name__ == "__main__":
    main()

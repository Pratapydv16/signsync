import os
import shutil
import subprocess
import sys

def download_data():
    """
    Downloads the ASL American Sign Language Alphabet Dataset from Kaggle
    and extracts it into the ./data folder, replacing any existing data.
    """
    dataset_id = "debashishsau/aslamerican-sign-language-aplhabet-dataset"
    data_dir = os.path.join(os.getcwd(), "data")

    print("--- Kaggle Dataset Downloader ---")

    # 1. Check for Kaggle CLI
    try:
        subprocess.run(["kaggle", "--version"], check=True, capture_output=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: Kaggle CLI not found or not working.")
        print("Please install it: pip install kaggle")
        print("And ensure you have your kaggle.json API key in ~/.kaggle/ (Windows: C:\\Users\\<User>\\.kaggle\\kaggle.json)")
        return

    # 2. Clear existing data folder
    if os.path.exists(data_dir):
        print(f"Clearing existing data folder: {data_dir}")
        try:
            # We use a retry/error handling because sometimes files are locked on Windows
            shutil.rmtree(data_dir)
        except Exception as e:
            print(f"Warning: Could not fully remove data folder. Error: {e}")
            print("Attempting to continue...")
    
    os.makedirs(data_dir, exist_ok=True)

    # 3. Download and Unzip
    print(f"Downloading dataset: {dataset_id}")
    print("This may take a while depending on your connection...")
    
    try:
        # Using subprocess.run to execute the kaggle command
        # -d: dataset identifier
        # -p: path to download to
        # --unzip: unzip the files after download
        subprocess.run([
            "kaggle", "datasets", "download",
            "-d", dataset_id,
            "-p", data_dir,
            "--unzip"
        ], check=True)
        
        print("\nSuccess! Dataset downloaded and extracted to ./data")
        
        # Optional: List contents to verify
        contents = os.listdir(data_dir)
        print(f"Found {len(contents)} items in ./data")
        
    except subprocess.CalledProcessError as e:
        print(f"\nFailed to download dataset. Exit code: {e.returncode}")
        print("Possible reasons:")
        print("1. Your Kaggle API credentials (kaggle.json) are missing or invalid.")
        print("2. You haven't accepted the dataset rules on Kaggle.com.")
        print("3. Network connectivity issues.")
    except Exception as e:
        print(f"\nAn unexpected error occurred: {e}")

if __name__ == "__main__":
    download_data()

import pickle
try:
    with open('data.pickle', 'rb') as f:
        d = pickle.load(f)
        print(f"Keys: {list(d.keys())}")
        print(f"Number of samples: {len(d['data'])}")
        print(f"Features in first sample: {len(d['data'][0])}")
        unique_labels = set(d['labels'])
        print(f"Unique labels: {sorted(unique_labels)}")
except Exception as e:
    print(f"Error: {e}")

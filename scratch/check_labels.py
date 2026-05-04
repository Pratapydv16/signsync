import pickle
data_dict = pickle.load(open('data.pickle', 'rb'))
labels = data_dict['labels']
unique_labels = set(labels)
print(f"Unique labels in data.pickle: {sorted(unique_labels)}")
counts = {lbl: labels.count(lbl) for lbl in unique_labels}
print(f"Counts: {counts}")

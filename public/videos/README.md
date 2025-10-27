# Folder Video SiBuDi

Folder ini digunakan untuk menyimpan file video demo SiBuDi.

## Cara Menambahkan Video

1. Masukkan file video ke dalam folder ini dengan nama:
   - `sibudi-demo.mp4` (format MP4)
   - `sibudi-demo.webm` (format WebM - opsional, untuk browser compatibility)

2. Format video yang direkomendasikan:
   - **Codec**: H.264 atau VP9
   - **Resolution**: 1280x720 (HD) atau 1920x1080 (Full HD)
   - **Bitrate**: 2-4 Mbps
   - **Duration**: 1-3 menit

3. Alternatif format tambahan:
   - OGG (opsional)
   - Format lain yang didukung browser modern

## Catatan

- Video akan otomatis diputar saat user scroll ke section video
- Jika video belum tersedia, akan ditampilkan fallback message
- Untuk preview video, gunakan file MP4 dengan kualitas yang dioptimalkan untuk web

## Tools untuk Konversi Video

Jika Anda perlu mengonversi video ke format yang sesuai:

### Menggunakan FFmpeg:
```bash
# Konversi ke MP4 (H.264)
ffmpeg -i input-video.mp4 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k sibudi-demo.mp4

# Konversi ke WebM (VP9)
ffmpeg -i input-video.mp4 -c:v libvpx-vp9 -crf 30 -b:v 0 -c:a libopus sibudi-demo.webm
```

### Menggunakan Online Tools:
- CloudConvert (https://cloudconvert.com)
- FreeConvert (https://www.freeconvert.com)
- Handbrake (https://handbrake.fr/)

## Tips Optimasi

1. **Kompres video**: Gunakan tools seperti Handbrake untuk mengurangi ukuran file
2. **Multiple formats**: Sediakan MP4 dan WebM untuk compatibility maksimal
3. **Thumbnail**: Gunakan poster image yang menarik
4. **Duration**: Jaga video tetap singkat dan informatif (1-3 menit)

---

**Dikembangkan oleh Tim SiBuDi**


<?php
// Test file upload
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    echo "PHP Upload Configuration:\n";
    echo "file_uploads: " . ini_get('file_uploads') . "\n";
    echo "upload_max_filesize: " . ini_get('upload_max_filesize') . "\n";
    echo "post_max_size: " . ini_get('post_max_size') . "\n";
    echo "max_file_uploads: " . ini_get('max_file_uploads') . "\n";
    echo "upload_tmp_dir: " . ini_get('upload_tmp_dir') . "\n";

    echo "\nFILES array:\n";
    print_r($_FILES);

    echo "\nPOST array:\n";
    print_r($_POST);

    // Test file upload
    if (!empty($_FILES['testFile']) && $_FILES['testFile']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = '../uploads/vaccines/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $fileName = 'test_' . time() . '_' . uniqid() . '.' . pathinfo($_FILES['testFile']['name'], PATHINFO_EXTENSION);
        $filePath = $uploadDir . $fileName;

        if (move_uploaded_file($_FILES['testFile']['tmp_name'], $filePath)) {
            echo "\nFile uploaded successfully to: $filePath\n";
        } else {
            echo "\nFailed to move uploaded file\n";
        }
    } else {
        echo "\nNo file uploaded or error: " . ($_FILES['testFile']['error'] ?? 'no file') . "\n";
    }
} else {
    echo "<form method='POST' enctype='multipart/form-data'>";
    echo "<input type='file' name='testFile'>";
    echo "<input type='submit' value='Upload Test'>";
    echo "</form>";
}
?>
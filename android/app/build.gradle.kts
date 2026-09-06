plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "com.dimillian.evergrow"
    compileSdk = 35
    defaultConfig { applicationId = "com.dimillian.evergrow"; minSdk = 30; targetSdk = 35; versionCode = 1; versionName = "0.1.0" }
    buildFeatures { buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies { implementation("androidx.webkit:webkit:1.12.1") }

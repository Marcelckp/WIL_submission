plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp") version "1.9.20-1.0.14"
}

configurations.all {
    exclude(group = "com.android.support")
    exclude(group = "android.support")
}

// Read API URL from gradle.properties or environment variable
val apiBaseUrl = project.findProperty("API_BASE_URL") as String?
    ?: System.getenv("API_BASE_URL")
    ?: "http://10.0.2.2:3000/api/" // Default to localhost for Android emulator

android {
    namespace = "com.smartinvoice.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.smartinvoice.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        
        // API base URL - reads from gradle.properties or environment variable
        // Defaults to localhost (10.0.2.2) for Android emulator
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Production API URL (uses same value from gradle.properties)
            buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
        }
        debug {
            // Uses API_BASE_URL from gradle.properties or environment variable
            // Defaults to http://10.0.2.2:3000/api/ for local development
            // For physical device, use your computer's IP address (e.g., http://192.168.1.XXX:3000/api/)
            buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
        }
    }
    
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    
    kotlinOptions {
        jvmTarget = "17"
    }
    
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
    
    // Disable JDK image transform to work around jlink issues
    lint {
        checkReleaseBuilds = false
    }
}

// Disable JDK image transform for Java compilation
tasks.withType<JavaCompile>().configureEach {
    options.isFork = false
}

dependencies {
    // Core Android
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    
    // Lifecycle
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.6.2")
    implementation("androidx.lifecycle:lifecycle-livedata-ktx:2.6.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.2")
    
    // Navigation
    implementation("androidx.navigation:navigation-fragment-ktx:2.7.6")
    implementation("androidx.navigation:navigation-ui-ktx:2.7.6")
    
    // Room
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    
    // Network
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    
    // Activity Result API
    implementation("androidx.activity:activity-ktx:1.8.2")
    
    // Image loading
    implementation("com.github.bumptech.glide:glide:4.16.0")
    
    // PDF viewer (active fork published via JitPack)
    implementation("com.github.mhiew:android-pdf-viewer:3.2.0-beta.1") {
        exclude(group = "com.android.support")
        exclude(group = "android.support")
    }
    
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    
    // WorkManager for background sync
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    
    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}


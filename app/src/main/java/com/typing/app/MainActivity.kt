package com.typing.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlin.random.Random

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF323437)
                ) {
                    TypingApp()
                }
            }
        }
    }
}

data class LeaderboardEntry(val name: String, val wpm: Int, val accuracy: Float)

val wordList = listOf("the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he", "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what", "so", "up", "out", "if", "about", "who", "get", "which", "go", "me")

@Composable
fun TypingApp() {
    var screen by remember { mutableStateOf("home") } // home, game, result, leaderboard
    var playerName by remember { mutableStateOf("") }
    val leaderboard = remember { mutableStateListOf<LeaderboardEntry>() }

    var targetWords by remember { mutableStateOf(generateWords()) }
    var typedText by remember { mutableStateOf("") }
    var timeLeft by remember { mutableStateOf(30) }
    var isRunning by remember { mutableStateOf(false) }
    
    var finalWpm by remember { mutableStateOf(0) }
    var finalAccuracy by remember { mutableStateOf(0f) }

    LaunchedEffect(isRunning, timeLeft) {
        if (isRunning && timeLeft > 0) {
            delay(1000L)
            timeLeft--
        } else if (isRunning && timeLeft == 0) {
            isRunning = false
            // Calculate final stats
            val correctChars = calculateCorrectChars(targetWords, typedText)
            finalWpm = (correctChars / 5.0 / (30.0 / 60.0)).toInt()
            val totalTyped = typedText.length
            finalAccuracy = if (totalTyped > 0) (correctChars.toFloat() / totalTyped.toFloat()) * 100 else 0f
            if (playerName.isNotBlank()) {
                leaderboard.add(LeaderboardEntry(playerName, finalWpm, finalAccuracy))
                leaderboard.sortByDescending { it.wpm }
            }
            screen = "result"
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 32.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("MonkeyType Clone", color = Color(0xFFE2B714), fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("Home", color = Color.Gray, modifier = Modifier.clickable { screen = "home" })
                Text("Leaderboard", color = Color.Gray, modifier = Modifier.clickable { screen = "leaderboard" })
            }
        }

        when (screen) {
            "home" -> {
                Text("Welcome to the Typing Test!", color = Color.White, fontSize = 24.sp)
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = playerName,
                    onValueChange = { playerName = it },
                    label = { Text("Player Name", color = Color.Gray) },
                    textStyle = TextStyle(color = Color.White),
                    modifier = Modifier.fillMaxWidth(0.8f)
                )
                Spacer(modifier = Modifier.height(32.dp))
                Button(
                    onClick = {
                        targetWords = generateWords()
                        typedText = ""
                        timeLeft = 30
                        isRunning = true
                        screen = "game"
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE2B714))
                ) {
                    Text("Start 30s Test", color = Color(0xFF323437))
                }
            }
            "game" -> {
                Text(
                    text = "$timeLeft s",
                    color = Color(0xFFE2B714),
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(16.dp))
                
                // Typing area
                val focusRequester = remember { FocusRequester() }
                LaunchedEffect(Unit) { focusRequester.requestFocus() }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(300.dp)
                        .background(Color(0xFF2C2E31), RoundedCornerShape(8.dp))
                        .clickable { focusRequester.requestFocus() }
                        .padding(16.dp)
                ) {
                    val annotatedString = buildAnnotatedString {
                        val targetString = targetWords.joinToString(" ")
                        val typedLength = typedText.length
                        
                        for (i in targetString.indices) {
                            if (i < typedLength) {
                                if (targetString[i] == typedText[i]) {
                                    withStyle(SpanStyle(color = Color.White)) { append(targetString[i].toString()) }
                                } else {
                                    withStyle(SpanStyle(color = Color(0xFFCA4754))) { 
                                        val charToAppend = if (targetString[i] == ' ') '_' else targetString[i]
                                        append(charToAppend.toString()) 
                                    }
                                }
                            } else {
                                withStyle(SpanStyle(color = Color(0xFF646669))) { append(targetString[i].toString()) }
                            }
                        }
                    }
                    Text(
                        text = annotatedString,
                        fontSize = 24.sp,
                        fontFamily = FontFamily.Monospace,
                        lineHeight = 36.sp
                    )
                    
                    BasicTextField(
                        value = typedText,
                        onValueChange = { 
                            if (isRunning && it.length <= targetWords.joinToString(" ").length) {
                                typedText = it
                            }
                        },
                        modifier = Modifier
                            .focusRequester(focusRequester)
                            .alpha(0f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii)
                    )
                }
                
                Spacer(modifier = Modifier.height(32.dp))
                Button(
                    onClick = {
                        isRunning = false
                        screen = "home"
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.DarkGray)
                ) {
                    Text("Cancel", color = Color.White)
                }
            }
            "result" -> {
                Text("Results", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(16.dp))
                Text("WPM: $finalWpm", color = Color(0xFFE2B714), fontSize = 48.sp)
                Text("Accuracy: ${String.format("%.1f", finalAccuracy)}%", color = Color.White, fontSize = 24.sp)
                Spacer(modifier = Modifier.height(32.dp))
                Button(
                    onClick = { screen = "home" },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE2B714))
                ) {
                    Text("Try Again", color = Color(0xFF323437))
                }
            }
            "leaderboard" -> {
                Text("Leaderboard", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(16.dp))
                if (leaderboard.isEmpty()) {
                    Text("No entries yet", color = Color.Gray)
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth(0.9f)
                    ) {
                        items(leaderboard) { entry ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp)
                                    .background(Color(0xFF2C2E31), RoundedCornerShape(8.dp))
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(entry.name, color = Color.White, fontSize = 20.sp)
                                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Text("${entry.wpm} WPM", color = Color(0xFFE2B714), fontSize = 20.sp)
                                    Text("${String.format("%.1f", entry.accuracy)}%", color = Color.Gray, fontSize = 20.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

fun generateWords(): List<String> {
    return (1..50).map { wordList[Random.nextInt(wordList.size)] }
}

fun calculateCorrectChars(targetWords: List<String>, typedText: String): Int {
    val targetString = targetWords.joinToString(" ")
    var correct = 0
    val length = minOf(targetString.length, typedText.length)
    for (i in 0 until length) {
        if (targetString[i] == typedText[i]) {
            correct++
        }
    }
    return correct
}
